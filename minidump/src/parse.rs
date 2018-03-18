#![allow(non_snake_case)]

use byteorder::{ByteOrder, LittleEndian};
use types::{Directory, Header, LocationDescriptor, MemoryInfo, Module, OverlayDescriptor};

pub type ParseData<'a> = &'a [u8];
pub type ParseResult<'a, T> = Result<(T, &'a [u8]), &'static str>;

fn take(data: ParseData, len: usize) -> ParseResult<ParseData> {
    if data.len() < len {
        return Err("Incomplete Data");
    } else {
        return Ok(data.split_at(len));
    }
}

pub fn parse_header(data: ParseData) -> ParseResult<Header> {
    /* struct MINIDUMP_HEADER {
        ULONG32     Signature;
        ULONG32     Version;
        ULONG32     NumberOfStreams;
        RVA32       StreamDirectoryRva;
        ULONG32     CheckSum;
        ULONG32     TimeDateStamp;
        ULONG64     Flags;
    } */

    let (raw, remain) = take(data, 32)?;

    let signature = &raw[0..4];
    let version = LittleEndian::read_u16(&raw[4..6]);

    if signature != b"MDMP" {
        return Err("Bad header magic");
    }

    if version != 42899 {
        return Err("Unsupported minidump version");
    }

    let header = Header {
        Version: version,
        NumberOfStreams: LittleEndian::read_u32(&raw[8..12]),
        StreamDirectory: LittleEndian::read_u32(&raw[12..16]),
        TimeDateStamp: LittleEndian::read_u32(&raw[20..24]),
        Flags: LittleEndian::read_u64(&raw[24..32]),
    };

    Ok((header, remain))
}

fn location(data: ParseData) -> ParseResult<LocationDescriptor> {
    /* struct MINIDUMP_LOCATION_DESCRIPTOR {
        ULONG32     DataSize;
        RVA32       Rva;
    } */

    let (raw, remain) = take(data, 8)?;

    let DataSize = LittleEndian::read_u32(&raw[0..4]);
    let Rva = LittleEndian::read_u32(&raw[4..8]);

    let loc = LocationDescriptor {
        Offset: Rva as u64,
        Length: DataSize as u64,
    };

    Ok((loc, remain))
}

fn directory_entry(data: ParseData) -> ParseResult<Directory> {
    /* struct MINIDUMP_DIRECTORY {
        ULONG32                         StreamType;
        MINIDUMP_LOCATION_DESCRIPTOR    Location;
    } */

    let (loc, remain) = location(&data[4..])?;

    let directory = Directory {
        StreamType: LittleEndian::read_u32(&data[0..4]),
        Location: loc,
    };

    Ok((directory, remain))
}

fn memory_info(data: ParseData) -> ParseResult<MemoryInfo> {
    /* struct MINIDUMP_MEMORY_INFO {
        ULONG64     BaseAddress;
        ULONG64     AllocationBase;
        ULONG32     AllocationProtect;
        ULONG32     __alignment1;
        ULONG64     RegionSize;
        ULONG32     State;
        ULONG32     Protect;
        ULONG32     Type;
        ULONG32     __alignment2;
     } */

    let (raw, remain) = take(data, 48)?;

    let mem_info = MemoryInfo {
        BaseAddress: LittleEndian::read_u64(&raw[0..8]),
        AllocationBase: LittleEndian::read_u64(&raw[8..16]),
        AllocationProtect: LittleEndian::read_u32(&raw[16..20]),
        RegionSize: LittleEndian::read_u64(&raw[24..32]),
        State: LittleEndian::read_u32(&raw[32..36]),
        Protect: LittleEndian::read_u32(&raw[36..40]),
        Type: LittleEndian::read_u32(&raw[40..44]),
    };

    Ok((mem_info, remain))
}

pub fn parse_directory<'a>(
    data: ParseData<'a>,
    header: &Header,
) -> ParseResult<'a, Vec<Directory>> {
    let mut vec = Vec::new();

    let rva = header.StreamDirectory as usize;
    if rva > data.len() {
        return Err("Cannot seek to StreamDirectory");
    }
    let mut raw = &data[rva..];

    vec.reserve(header.NumberOfStreams as usize);
    for _ in 0..header.NumberOfStreams {
        let (entry, raw_next) = directory_entry(raw)?;
        vec.push(entry);
        raw = raw_next;
    }

    Ok((vec, data))
}

pub fn parse_memory_info<'a>(
    data: ParseData<'a>,
    loc: &LocationDescriptor,
) -> ParseResult<'a, Vec<MemoryInfo>> {
    /* struct MINIDUMP_MEMORY_INFO_LIST {
        ULONG SizeOfHeader;
        ULONG SizeOfEntry;
        ULONG64 NumberOfEntries;
    } */

    let mut vec = Vec::new();

    let offset = loc.Offset as usize;
    if offset > data.len() {
        return Err("Cannot seek to Stream");
    }
    let raw = &data[offset..];

    let SizeOfHeader = LittleEndian::read_u32(&raw[0..4]) as u64;
    let SizeOfEntry = LittleEndian::read_u32(&raw[4..8]) as u64;
    let NumberOfEntries = LittleEndian::read_u64(&raw[8..16]);

    if NumberOfEntries > u32::max_value() as u64 {
        return Err("Unexpected number of entries");
    }
    if SizeOfHeader + NumberOfEntries * SizeOfEntry != loc.Length {
        return Err("Unexpected Stream size");
    }

    vec.reserve(NumberOfEntries as usize);
    for i in 0..NumberOfEntries {
        let offset = (SizeOfHeader + i * SizeOfEntry) as usize;
        let (entry, _) = memory_info(&raw[offset..])?;
        vec.push(entry);
    }

    Ok((vec, data))
}

fn module(data: ParseData) -> ParseResult<Module> {
    /* struct MINIDUMP_MODULE {
        ULONG64                         BaseOfImage;
        ULONG32                         SizeOfImage;
        ULONG32                         CheckSum;
        ULONG32                         TimeDateStamp;
        RVA32                           ModuleNameRva;
        VS_FIXEDFILEINFO                VersionInfo;
        MINIDUMP_LOCATION_DESCRIPTOR    CvRecord;
        MINIDUMP_LOCATION_DESCRIPTOR    MiscRecord;
        ULONG64                         Reserved0;
        ULONG64                         Reserved1;
    } */

    let (raw, remain) = take(data, 108)?;

    let module = Module {
        BaseOfImage: LittleEndian::read_u64(&raw[0..8]),
        SizeOfImage: LittleEndian::read_u32(&raw[8..12]),
        CheckSum: LittleEndian::read_u32(&raw[12..16]),
        TimeDateStamp: LittleEndian::read_u32(&raw[16..20]),
        ModuleNameRva: LittleEndian::read_u32(&raw[20..24]),

        ModuleName: None,
    };

    Ok((module, remain))
}

pub fn parse_string<'a>(data: ParseData<'a>, rva_: u32) -> ParseResult<'a, String> {
    /* struct MINIDUMP_STRING {
        ULONG32 Length;
        WCHAR   Buffer[];
    } */

    let rva = rva_ as usize;
    if rva > data.len() {
        return Err("Cannot seek to Stream");
    }
    let raw = &data[rva..];

    let Length = LittleEndian::read_u32(&raw[0..4]) / 2;

    let mut elems = Vec::new();
    for i in 0..Length {
        let offset = (4 + i * 2) as usize;
        let elem = LittleEndian::read_u16(&raw[offset..]);
        elems.push(elem);
    }
    let string = String::from_utf16(&elems).map_err(|_| "bad UTF-16 data")?;

    Ok((string, data))
}

pub fn parse_module_list<'a>(
    data: ParseData<'a>,
    loc: &LocationDescriptor,
) -> ParseResult<'a, Vec<Module>> {
    /* struct MINIDUMP_MODULE_LIST {
        ULONG32 NumberOfModules;
    } */

    let mut vec = Vec::new();

    let offset = loc.Offset as usize;
    if offset > data.len() {
        return Err("Cannot seek to Stream");
    }
    let raw = &data[offset..];

    let SizeOfHeader = 4; // Packed header size
    let SizeOfEntry = 108; // Packed MINIDUMP_MODULE size
    let NumberOfModules = LittleEndian::read_u32(&raw[0..4]) as u64;

    if NumberOfModules > u32::max_value() as u64 {
        return Err("Unexpected number of modules");
    }
    if SizeOfHeader + NumberOfModules * SizeOfEntry != loc.Length {
        return Err("Unexpected Stream size");
    }

    vec.reserve(NumberOfModules as usize);
    for i in 0..NumberOfModules {
        let offset = (SizeOfHeader + i * SizeOfEntry) as usize;
        let (mut entry, _) = module(&raw[offset..])?;

        // Look up name string
        if entry.ModuleNameRva > 0 {
            let (name, _) = parse_string(data, entry.ModuleNameRva)?;
            entry.ModuleName = Some(name);
        }

        vec.push(entry);
    }

    Ok((vec, data))
}

fn memory_range(data: ParseData) -> ParseResult<OverlayDescriptor> {
    /* struct MINIDUMP_MEMORY_DESCRIPTOR {
        ULONG64                         StartOfMemoryRange;
        MINIDUMP_LOCATION_DESCRIPTOR    Memory;
    } */

    let StartOfMemoryRange = LittleEndian::read_u64(&data[0..8]);
    let (loc, remain) = location(&data[8..])?;

    let range = OverlayDescriptor {
        Address: StartOfMemoryRange,
        Location: loc,
    };

    Ok((range, remain))
}

pub fn parse_memory_list<'a>(
    data: ParseData<'a>,
    loc: &LocationDescriptor,
) -> ParseResult<'a, Vec<OverlayDescriptor>> {
    /* struct MINIDUMP_MEMORY_LIST {
        ULONG32 NumberOfMemoryRanges;
    } */

    let mut vec = Vec::new();

    let offset = loc.Offset as usize;
    if offset > data.len() {
        return Err("Cannot seek to Stream");
    }
    let raw = &data[offset..];

    let SizeOfHeader = 4; // Packed header size
    let SizeOfEntry = 16; // Packed MINIDUMP_MEMORY_DESCRIPTOR size
    let NumberOfMemoryRanges = LittleEndian::read_u32(&raw[0..4]) as u64;

    if NumberOfMemoryRanges > u32::max_value() as u64 {
        return Err("Unexpected number of memory ranges");
    }
    if SizeOfHeader + NumberOfMemoryRanges * SizeOfEntry != loc.Length {
        return Err("Unexpected Stream size");
    }

    vec.reserve(NumberOfMemoryRanges as usize);
    for i in 0..NumberOfMemoryRanges {
        let offset = (SizeOfHeader + i * SizeOfEntry) as usize;
        let (mut entry, _) = memory_range(&raw[offset..])?;

        vec.push(entry);
    }

    Ok((vec, data))
}

fn memory_range64(data: ParseData, base: u64) -> ParseResult<OverlayDescriptor> {
    /* struct MINIDUMP_MEMORY_DESCRIPTOR {
        ULONG64 StartOfMemoryRange;
        ULONG64 DataSize;
    } */

    let (raw, remain) = take(data, 16)?;
    let StartOfMemoryRange = LittleEndian::read_u64(&raw[0..8]);
    let DataSize = LittleEndian::read_u64(&raw[8..16]);

    let range = OverlayDescriptor {
        Address: StartOfMemoryRange,
        Location: LocationDescriptor {
            Offset: base,
            Length: DataSize,
        },
    };

    Ok((range, remain))
}

pub fn parse_memory64_list<'a>(
    data: ParseData<'a>,
    loc: &LocationDescriptor,
) -> ParseResult<'a, Vec<OverlayDescriptor>> {
    /* struct MINIDUMP_MEMORY64_LIST {
        ULONG64 NumberOfMemoryRanges;
        RVA64   BaseRva;
    } */

    let mut vec = Vec::new();

    let offset = loc.Offset as usize;
    if offset > data.len() {
        return Err("Cannot seek to Stream");
    }
    let raw = &data[offset..];

    let SizeOfHeader = 16; // Packed header size
    let SizeOfEntry = 16; // Packed MINIDUMP_MEMORY_DESCRIPTOR64 size
    let NumberOfMemoryRanges = LittleEndian::read_u64(&raw[0..8]);
    let mut BaseRva = LittleEndian::read_u64(&raw[8..16]);

    if NumberOfMemoryRanges > u32::max_value() as u64 {
        return Err("Unexpected number of memory ranges");
    }
    if SizeOfHeader + NumberOfMemoryRanges * SizeOfEntry != loc.Length {
        return Err("Unexpected Stream size");
    }

    vec.reserve(NumberOfMemoryRanges as usize);
    for i in 0..NumberOfMemoryRanges {
        let offset = (SizeOfHeader + i * SizeOfEntry) as usize;
        let (mut entry, _) = memory_range64(&raw[offset..], BaseRva)?;

        // Memory64 data is stored contiguously at end of file so RVA of a chunk
        // is BaseRva plus size of all chunks before.
        BaseRva += entry.Location.Length;

        vec.push(entry);
    }

    Ok((vec, data))
}
