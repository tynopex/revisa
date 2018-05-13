#![allow(non_snake_case)]

pub struct Header {
    pub Version: u16,
    pub NumberOfStreams: u32,
    pub StreamDirectory: u32,
    pub TimeDateStamp: u32,
    pub Flags: u64,
}

#[derive(Serialize)]
pub struct LocationDescriptor {
    pub Offset: u64,
    pub Length: u64,
}

#[derive(Serialize)]
pub struct OverlayDescriptor {
    pub Address: u64,
    pub Location: LocationDescriptor,
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
pub struct ContextX86 {
    pub EFlags: u32,
    pub Eip: u32,
    pub Eax: u32,
    pub Ebx: u32,
    pub Ecx: u32,
    pub Edx: u32,
    pub Esp: u32,
    pub Ebp: u32,
    pub Esi: u32,
    pub Edi: u32,
}

#[derive(Serialize)]
pub struct ContextX64 {
    pub EFlags: u32,
    pub Rip: u64,
    pub Rax: u64,
    pub Rbx: u64,
    pub Rcx: u64,
    pub Rdx: u64,
    pub Rsp: u64,
    pub Rbp: u64,
    pub Rsi: u64,
    pub Rdi: u64,
    pub R8: u64,
    pub R9: u64,
    pub R10: u64,
    pub R11: u64,
    pub R12: u64,
    pub R13: u64,
    pub R14: u64,
    pub R15: u64,
}

#[derive(Serialize)]
#[serde(tag = "type")]
pub enum MaybeThreadContext {
    None,
    X86(ContextX86),
    X64(ContextX64),
}

#[derive(Serialize)]
pub struct Thread {
    pub ThreadId: u32,
    pub SuspendCount: u32,
    pub PriorityClass: u32,
    pub Priority: u32,
    pub Teb: u64,
    pub Stack: OverlayDescriptor,
    pub ThreadContext: LocationDescriptor,

    pub Context: MaybeThreadContext,
}

#[derive(Serialize)]
pub struct ExceptionRecord {
    pub Code: u32,
    pub Flags: u32,
    pub Address: u64,
    pub Information: Vec<u64>,
}

#[derive(Serialize)]
pub struct ExceptionStream {
    pub ThreadId: u32,
    pub Exception: ExceptionRecord,
    pub ThreadContext: LocationDescriptor,

    pub Context: MaybeThreadContext,
}

#[derive(Serialize)]
pub struct SystemInfo {
    pub ProcessorArchitecture: u16,
    pub ProcessorFamily: u16,
    pub ProcessorModel: u8,
    pub ProcessorStepping: u8,
    pub NumberOfProcessors: u8,
    pub MajorVersion: u32,
    pub MinorVersion: u32,
    pub BuildNumber: u32,
    pub CSDVersionRva: u32,
    pub ProcessorFeatures: Vec<u32>,

    pub ServicePack: Option<String>,
}
