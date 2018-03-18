#![allow(non_snake_case)]

pub struct Header {
    pub Version: u16,
    pub NumberOfStreams: u32,
    pub StreamDirectory: u32,
    pub TimeDateStamp: u32,
    pub Flags: u64,
}

pub struct LocationDescriptor {
    pub DataSize: u64,
    pub Rva: u64,
}

#[derive(Debug)]
#[allow(unused)]
pub enum StreamType {
    UnusedStream = 0,
    ThreadListStream = 3,
    ModuleListStream = 4,
    MemoryListStream = 5,
    ExceptionStream = 6,
    SystemInfoStream = 7,
    ThreadExListStream = 8,
    Memory64ListStream = 9,
    CommentStreamA = 10,
    CommentStreamW = 11,
    HandleDataStream = 12,
    FunctionTableStream = 13,
    UnloadedModuleListStream = 14,
    MiscInfoStream = 15,
    MemoryInfoListStream = 16,
    ThreadInfoListStream = 17,
    HandleOperationListStream = 18,
    TokenStream = 19,
    JavaScriptDataStream = 20,
}

pub struct Directory {
    pub StreamType: u32,
    pub Location: LocationDescriptor,
}

#[derive(Serialize)]
pub struct MemoryInfo {
    pub BaseAddress: u64,
    pub AllocationBase: u64,
    pub AllocationProtect: u32,
    pub RegionSize: u64,
    pub State: u32,
    pub Protect: u32,
    pub Type: u32,
}

#[derive(Serialize)]
pub struct Module {
    pub BaseOfImage: u64,
    pub SizeOfImage: u32,
    pub CheckSum: u32,
    pub TimeDateStamp: u32,
    pub ModuleNameRva: u32,

    pub ModuleName: Option<String>,
}

#[derive(Serialize)]
pub struct MemoryRange {
    pub StartOfMemoryRange: u64,
    pub DataSize: u64,
    pub Rva: u64,
}
