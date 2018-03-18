#![allow(non_snake_case)]

use parse;
use types::{MemoryInfo, StreamType};

#[derive(Serialize)]
pub struct ProtectionRegion {
    pub BaseAddress: u64,
    pub RegionSize: u64,
    pub State: u32,
    pub Protect: u32,
    pub Type: u32,
}

#[derive(Serialize)]
pub struct AllocationRegion {
    pub AllocationBase: u64,
    pub AllocationSize: u64,
    pub AllocationProtect: u32,

    pub ModuleName: Option<String>,
    pub Regions: Vec<ProtectionRegion>,
}

// Windows Memory Constants
const MEM_FREE: u32 = 0x00010000;
const PAGE_NOACCESS: u32 = 0x00000001;

// Group memory regions by allocation region
fn find_allocation_regions(meminfo: &[MemoryInfo]) -> Vec<AllocationRegion> {
    const INITIAL_VA: u64 = 0x0;
    let mut next_va: u64 = INITIAL_VA;
    let mut regions = Vec::new();

    for info in meminfo {
        // We expect memory info to be in increasing order and complete.
        assert!(info.BaseAddress == next_va);
        next_va = info.BaseAddress + info.RegionSize;

        let current_va = regions
            .last()
            .map(|x: &AllocationRegion| x.AllocationBase)
            .unwrap_or(INITIAL_VA);

        if info.AllocationBase == INITIAL_VA {
            // An AllocationBase value of 0 should only be used for unallocated
            // memory. Perform checks that the memory flags match expectations.
            assert!(info.AllocationProtect == 0);
            assert!(info.Protect == PAGE_NOACCESS);
            assert!(info.State == MEM_FREE);
            assert!(info.Type == 0);
        } else {
            // Create new AllocationRegion if this info is not in current.
            if info.AllocationBase != current_va {
                regions.push(AllocationRegion {
                    AllocationBase: info.AllocationBase,
                    AllocationSize: 0,
                    AllocationProtect: info.AllocationProtect,
                    ModuleName: None,
                    Regions: Vec::new(),
                });
            }

            let mut current = regions.last_mut().unwrap();

            assert!(info.AllocationBase == current.AllocationBase);
            assert!(info.AllocationProtect == current.AllocationProtect);
            assert!(info.BaseAddress == current.AllocationBase + current.AllocationSize);

            let protect_region = ProtectionRegion {
                BaseAddress: info.BaseAddress,
                RegionSize: info.RegionSize,
                State: info.State,
                Protect: info.Protect,
                Type: info.Type,
            };

            current.AllocationSize += info.RegionSize;
            current.Regions.push(protect_region);
        }
    }

    regions
}

// Rebuilds minidump data into a more useful format
pub fn memory_analysis(dump: &[u8]) -> Vec<AllocationRegion> {
    let header = parse::parse_header(&dump)
        .map(|(h, _)| h)
        .expect("Failed to parse minidump::Header");

    let dir = parse::parse_directory(&dump, &header)
        .map(|(d, _)| d)
        .expect("Failed to parse minidump Directory list");

    let meminfostream = dir.iter()
        .find(|&el| el.StreamType == StreamType::MemoryInfoListStream as u32)
        .expect("Unable to find memory info stream");

    let meminfo = parse::parse_memory_info(&dump, &meminfostream.Location)
        .map(|(v, _)| v)
        .unwrap();

    let alloc_regions = find_allocation_regions(&meminfo);

    alloc_regions
}
