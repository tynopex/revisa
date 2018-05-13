#![allow(non_snake_case)]

use byteorder::{ByteOrder, LittleEndian};
use types::{ContextX64, ContextX86, Directory, ExceptionRecord, ExceptionStream, Header,
            LocationDescriptor, MaybeThreadContext, MemoryInfo, Module, OverlayDescriptor, Thread};

pub type ParseData<'a> = &'a [u8];
pub type ParseResult<'a, T> = Result<(T, &'a [u8]), &'static str>;

fn take(data: ParseData, len: usize) -> ParseResult<ParseData> {
    if data.len() < len {
        return Err("Incomplete Data");
    }

    Ok(data.split_at(len))
}

fn seek(data: ParseData, offset: usize) -> ParseResult<ParseData> {
    if offset >= data.len() {
        return Err("Cannot seek to data");
    }
    let raw = &data[offset..];

    Ok(raw.split_at(raw.len()))
}

fn seek_stream<'a>(
    data: ParseData<'a>,
    loc: &LocationDescriptor,
) -> ParseResult<'a, ParseData<'a>> {
    let offset = loc.Offset as usize;
    let len = loc.Length as usize;

    let (seek_data, remain) = seek(data, offset)?;
    take(seek_data, len).map(|(d, _)| (d, remain))
}

macro_rules! define_array_T {
    ($fn_name:ident, $type:ident, $reader_fn:expr) => {
        fn $fn_name<T>(data: ParseData, count: usize) -> ParseResult<Vec<T>>
        where
            T: From<$type>,
        {
            use std::mem::size_of;

            let mut v = Vec::with_capacity(count);
            let size = size_of::<$type>();
            let (raw, remain) = take(data, count * size)?;

            for i in 0..count {
                let ofs = i * size;
                let val = $reader_fn(&raw[ofs..ofs + size]);
                v.push(T::from(val));
            }

            Ok((v, remain))
        }
    };
}

define_array_T!(array_u32, u32, LittleEndian::read_u32);
define_array_T!(array_u64, u64, LittleEndian::read_u64);

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

    let (raw, remain) = take(data, 4)?;
    let (loc, remain) = location(remain)?;

    let directory = Directory {
        StreamType: LittleEndian::read_u32(&raw[0..4]),
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
    let rva = header.StreamDirectory as usize;
    let (mut raw, remain) = seek(data, rva)?;

    let mut vec = Vec::new();
    vec.reserve(header.NumberOfStreams as usize);
    for _ in 0..header.NumberOfStreams {
        let (entry, raw_next) = directory_entry(raw)?;
        vec.push(entry);
        raw = raw_next;
    }

    Ok((vec, remain))
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

    let (raw, remain) = seek_stream(data, loc)?;

    let SizeOfHeader = LittleEndian::read_u32(&raw[0..4]) as u64;
    let SizeOfEntry = LittleEndian::read_u32(&raw[4..8]) as u64;
    let NumberOfEntries = LittleEndian::read_u64(&raw[8..16]);

    if NumberOfEntries > u32::max_value() as u64 {
        return Err("Unexpected number of entries");
    }
    if SizeOfHeader + NumberOfEntries * SizeOfEntry != loc.Length {
        return Err("Unexpected Stream size");
    }

    let mut vec = Vec::new();
    vec.reserve(NumberOfEntries as usize);
    for i in 0..NumberOfEntries {
        let offset = (SizeOfHeader + i * SizeOfEntry) as usize;
        let (entry, _) = memory_info(&raw[offset..])?;
        vec.push(entry);
    }

    Ok((vec, remain))
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

pub fn parse_string(data: ParseData, rva: u32) -> ParseResult<String> {
    /* struct MINIDUMP_STRING {
        ULONG32 Length;
        WCHAR   Buffer[];
    } */

    let (raw, remain) = seek(data, rva as usize)?;

    let SizeOfHeader = 4;
    let SizeOfEntry = 2; // sizeof WCHAR
    let Length = LittleEndian::read_u32(&raw[0..4]) / SizeOfEntry;

    let mut elems = Vec::new();
    for i in 0..Length {
        let offset = (SizeOfHeader + i * SizeOfEntry) as usize;
        let elem = LittleEndian::read_u16(&raw[offset..]);
        elems.push(elem);
    }
    let string = String::from_utf16(&elems).map_err(|_| "bad UTF-16 data")?;

    Ok((string, remain))
}

pub fn parse_module_list<'a>(
    data: ParseData<'a>,
    loc: &LocationDescriptor,
) -> ParseResult<'a, Vec<Module>> {
    /* struct MINIDUMP_MODULE_LIST {
        ULONG32 NumberOfModules;
    } */

    let (raw, remain) = seek_stream(data, loc)?;

    let SizeOfHeader = 4;
    let SizeOfEntry = 108; // sizeof MINIDUMP_MODULE
    let NumberOfModules = LittleEndian::read_u32(&raw[0..4]) as u64;

    if NumberOfModules > u32::max_value() as u64 {
        return Err("Unexpected number of modules");
    }
    if SizeOfHeader + NumberOfModules * SizeOfEntry != loc.Length {
        return Err("Unexpected Stream size");
    }

    let mut vec = Vec::new();
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

    Ok((vec, remain))
}

fn memory_range(data: ParseData) -> ParseResult<OverlayDescriptor> {
    /* struct MINIDUMP_MEMORY_DESCRIPTOR {
        ULONG64                         StartOfMemoryRange;
        MINIDUMP_LOCATION_DESCRIPTOR    Memory;
    } */

    let (raw, remain) = take(data, 8)?;
    let (loc, remain) = location(remain)?;

    let range = OverlayDescriptor {
        Address: LittleEndian::read_u64(&raw[0..8]),
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

    let (raw, remain) = seek_stream(data, loc)?;

    let SizeOfHeader = 4;
    let SizeOfEntry = 16; // sizeof MINIDUMP_MEMORY_DESCRIPTOR
    let NumberOfMemoryRanges = LittleEndian::read_u32(&raw[0..4]) as u64;

    if NumberOfMemoryRanges > u32::max_value() as u64 {
        return Err("Unexpected number of memory ranges");
    }
    if SizeOfHeader + NumberOfMemoryRanges * SizeOfEntry != loc.Length {
        return Err("Unexpected Stream size");
    }

    let mut vec = Vec::new();
    vec.reserve(NumberOfMemoryRanges as usize);
    for i in 0..NumberOfMemoryRanges {
        let offset = (SizeOfHeader + i * SizeOfEntry) as usize;
        let (entry, _) = memory_range(&raw[offset..])?;

        vec.push(entry);
    }

    Ok((vec, remain))
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

    let (raw, remain) = seek_stream(data, loc)?;

    let SizeOfHeader = 16;
    let SizeOfEntry = 16; // sizeof MINIDUMP_MEMORY_DESCRIPTOR64
    let NumberOfMemoryRanges = LittleEndian::read_u64(&raw[0..8]);
    let mut BaseRva = LittleEndian::read_u64(&raw[8..16]);

    if NumberOfMemoryRanges > u32::max_value() as u64 {
        return Err("Unexpected number of memory ranges");
    }
    if SizeOfHeader + NumberOfMemoryRanges * SizeOfEntry != loc.Length {
        return Err("Unexpected Stream size");
    }

    let mut vec = Vec::new();
    vec.reserve(NumberOfMemoryRanges as usize);
    for i in 0..NumberOfMemoryRanges {
        let offset = (SizeOfHeader + i * SizeOfEntry) as usize;
        let (entry, _) = memory_range64(&raw[offset..], BaseRva)?;

        // Memory64 data is stored contiguously at end of file so RVA of a chunk
        // is BaseRva plus size of all chunks before.
        BaseRva += entry.Location.Length;

        vec.push(entry);
    }

    Ok((vec, remain))
}

fn thread(data: ParseData) -> ParseResult<Thread> {
    /* struct MINIDUMP_THREAD {
        ULONG32                         ThreadId;
        ULONG32                         SuspendCount;
        ULONG32                         PriorityClass;
        ULONG32                         Priority;
        ULONG64                         Teb;
        MINIDUMP_MEMORY_DESCRIPTOR      Stack;
        MINIDUMP_LOCATION_DESCRIPTOR    ThreadContext;
    } */

    let (raw, remain) = take(data, 24)?;
    let (stack, remain) = memory_range(remain)?;
    let (context, remain) = location(remain)?;

    let thread = Thread {
        ThreadId: LittleEndian::read_u32(&raw[0..4]),
        SuspendCount: LittleEndian::read_u32(&raw[4..8]),
        PriorityClass: LittleEndian::read_u32(&raw[8..12]),
        Priority: LittleEndian::read_u32(&raw[12..16]),
        Teb: LittleEndian::read_u64(&raw[16..24]),
        Stack: stack,
        ThreadContext: context,

        Context: MaybeThreadContext::None,
    };

    Ok((thread, remain))
}

pub fn parse_thread_context_x86<'a>(
    data: ParseData<'a>,
    loc: &LocationDescriptor,
) -> ParseResult<'a, ContextX86> {
    /* struct CONTEXT {
        DWORD               ContextFlags;

        // +0004: Debug registers
        DWORD               Dr0, Dr1, Dr2, Dr3, Dr6, Dr7;

        // +0028: Floating point state
        FLOATING_SAVE_AREA  FloatSave;

        // +0140: Segment Registers
        DWORD               SegGs, SegFs, SegEs, SegDs;

        // +0156: Integer registers
        DWORD               Edi, Esi, Ebx, Edx, Ecx, Eax;

        // +0180: Program counter, stack registers, and flags
        DWORD               Ebp;
        DWORD               Eip;
        DWORD               SegCs;
        DWORD               EFlags;
        DWORD               Esp;
        DWORD               SegSs;

        // +0204: Additional registers
        BYTE                ExtendedRegisters[MAXIMUM_SUPPORTED_EXTENSION];
    } */

    let (raw, remain) = seek_stream(data, loc)?;

    let SizeOfHeader = 716;
    if SizeOfHeader != loc.Length {
        return Err("Unexpected Stream size");
    }

    let (regs, _) = array_u32(&raw[156..204], 12)?;

    // NOTE: Fields listed in parse order
    let context = ContextX86 {
        Edi: regs[0],
        Esi: regs[1],
        Ebx: regs[2],
        Edx: regs[3],
        Ecx: regs[4],
        Eax: regs[5],
        Ebp: regs[6],
        Eip: regs[7],
        EFlags: regs[9],
        Esp: regs[10],
    };

    Ok((context, remain))
}

pub fn parse_thread_context_x64<'a>(
    data: ParseData<'a>,
    loc: &LocationDescriptor,
) -> ParseResult<'a, ContextX64> {
    /* struct CONTEXT {
        // +0000: Register parameter home addresses
        DWORD64         P1Home, P2Home, P3Home, P4Home, P5Home, P6Home;

        // +0048: Control flags
        DWORD           ContextFlags;
        DWORD           MxCsr;

        // +0056: Segment Registers and processor flags
        WORD            SegCs, SegDs, SegEs, SegFs, SegGs, SegSs;
        DWORD           EFlags;

        // +0072: Debug registers
        DWORD64         Dr0, Dr1, Dr2, Dr3, Dr6, Dr7;

        // +0120: Integer registers
        DWORD64         Rax, Rcx, Rdx, Rbx, Rsp, Rbp, Rsi, Rdi;
        DWORD64         R8, R9, R10, R11, R12, R13, R14, R15;

        // +0248: Program counter
        DWORD64         Rip;

        // +0256: Floating point state
        XMM_SAVE_AREA32 FltSave; // 512-Byte

        // +0768: Vector registers
        M128A           VectorRegister[26];
        DWORD64         VectorControl;

        // +1192: Special debug control registers
        DWORD64         DebugControl;
        DWORD64         LastBranchToRip;
        DWORD64         LastBranchFromRip;
        DWORD64         LastExceptionToRip;
        DWORD64         LastExceptionFromRip;
    } */

    let (raw, remain) = seek_stream(data, loc)?;

    let SizeOfHeader = 1232;
    if SizeOfHeader != loc.Length {
        return Err("Unexpected Stream size");
    }

    let eflags = LittleEndian::read_u32(&raw[68..72]);
    let (regs, _) = array_u64(&raw[120..256], 17)?;

    // NOTE: Fields listed in parse order
    let context = ContextX64 {
        EFlags: eflags,
        Rax: regs[0],
        Rcx: regs[1],
        Rdx: regs[2],
        Rbx: regs[3],
        Rsp: regs[4],
        Rbp: regs[5],
        Rsi: regs[6],
        Rdi: regs[7],
        R8: regs[8],
        R9: regs[9],
        R10: regs[10],
        R11: regs[11],
        R12: regs[12],
        R13: regs[13],
        R14: regs[14],
        R15: regs[15],
        Rip: regs[16],
    };

    Ok((context, remain))
}

fn thread_context<'a>(
    data: ParseData<'a>,
    loc: &LocationDescriptor,
) -> ParseResult<'a, MaybeThreadContext> {
    // Decode X86 CONTEXT
    if loc.Length == 716 {
        let (context, remain) = parse_thread_context_x86(data, loc)?;
        return Ok((MaybeThreadContext::X86(context), remain));
    }

    // Decode X64 CONTEXT
    if loc.Length == 1232 {
        let (context, remain) = parse_thread_context_x64(data, loc)?;
        return Ok((MaybeThreadContext::X64(context), remain));
    }

    Ok((MaybeThreadContext::None, data))
}

pub fn parse_thread_list<'a>(
    data: ParseData<'a>,
    loc: &LocationDescriptor,
) -> ParseResult<'a, Vec<Thread>> {
    /* struct MINIDUMP_THREAD_LIST {
        ULONG32 NumberOfThreads;
    } */

    let (raw, remain) = seek_stream(data, loc)?;

    let SizeOfHeader = 4;
    let SizeOfEntry = 48; // sizeof MINIDUMP_THREAD
    let NumberOfThreads = LittleEndian::read_u32(&raw[0..4]) as u64;

    if NumberOfThreads > u32::max_value() as u64 {
        return Err("Unexpected number of threads");
    }
    if SizeOfHeader + NumberOfThreads * SizeOfEntry != loc.Length {
        return Err("Unexpected Stream size");
    }

    let mut vec = Vec::new();
    vec.reserve(NumberOfThreads as usize);
    for i in 0..NumberOfThreads {
        let offset = (SizeOfHeader + i * SizeOfEntry) as usize;
        let (mut entry, _) = thread(&raw[offset..])?;

        let (context, _) = thread_context(data, &entry.ThreadContext)?;
        entry.Context = context;

        vec.push(entry);
    }

    Ok((vec, remain))
}

fn exception_record_32(data: ParseData) -> ParseResult<ExceptionRecord> {
    /* struct EXCEPTION_RECORD32 {
        DWORD       ExceptionCode;
        DWORD       ExceptionFlags;
        DWORD       ExceptionRecord;
        DWORD       ExceptionAddress;
        DWORD       NumberParameters;
        DWORD       ExceptionInformation[EXCEPTION_MAXIMUM_PARAMETERS];
    } */

    let (raw, remain) = take(data, 80)?;

    let ExceptionRecord = LittleEndian::read_u32(&raw[8..12]);
    if ExceptionRecord != 0 {
        return Err("Unexpected exception chain");
    }

    let NumberParameters = LittleEndian::read_u32(&raw[16..20]) as usize;
    if NumberParameters > 15 {
        return Err("Invalid number of exception parameters");
    }

    let (Information, _) = array_u32(&raw[20..], NumberParameters)?;

    let rec = ExceptionRecord {
        Code: LittleEndian::read_u32(&raw[0..4]),
        Flags: LittleEndian::read_u32(&raw[4..8]),
        Address: LittleEndian::read_u32(&raw[12..16]) as u64,
        Information: Information,
    };

    Ok((rec, remain))
}

fn exception_record_64(data: ParseData) -> ParseResult<ExceptionRecord> {
    /* struct EXCEPTION_RECORD64 {
        DWORD       ExceptionCode;
        DWORD       ExceptionFlags;
        DWORD64     ExceptionRecord;
        DWORD64     ExceptionAddress;
        DWORD       NumberParameters;
        DWORD       __unusedAlignment;
        DWORD64     ExceptionInformation[EXCEPTION_MAXIMUM_PARAMETERS];
    } */

    let (raw, remain) = take(data, 152)?;

    let ExceptionRecord = LittleEndian::read_u64(&raw[8..16]);
    if ExceptionRecord != 0 {
        return Err("Unexpected exception chain");
    }

    let NumberParameters = LittleEndian::read_u32(&raw[24..28]) as usize;
    if NumberParameters > 15 {
        return Err("Invalid number of exception parameters");
    }

    let (Information, _) = array_u64(&raw[32..], NumberParameters)?;

    let rec = ExceptionRecord {
        Code: LittleEndian::read_u32(&raw[0..4]),
        Flags: LittleEndian::read_u32(&raw[4..8]),
        Address: LittleEndian::read_u64(&raw[16..24]),
        Information: Information,
    };

    Ok((rec, remain))
}

pub fn parse_exception_stream<'a>(
    data: ParseData<'a>,
    loc: &LocationDescriptor,
) -> ParseResult<'a, ExceptionStream> {
    /* struct MINIDUMP_EXCEPTION_STREAM {
        ULONG32                         ThreadId;
        ULONG32                         __alignment;
        MINIDUMP_EXCEPTION              ExceptionRecord;
        MINIDUMP_LOCATION_DESCRIPTOR    ThreadContext;
    } */

    let (seek_raw, seek_remain) = seek_stream(data, loc)?;

    let SizeOfHeader32 = 104;
    let SizeOfHeader64 = 168;
    if SizeOfHeader32 != loc.Length && SizeOfHeader64 != loc.Length {
        return Err("Unexpected Stream size");
    }

    // Use length of stream to guess format
    let exception_record_fn = if SizeOfHeader32 == loc.Length {
        exception_record_32
    } else {
        exception_record_64
    };

    let (raw, remain) = take(seek_raw, 8)?;
    let (exception_record, remain) = exception_record_fn(remain)?;
    let (context_loc, _) = location(remain)?;

    let (context, _) = thread_context(data, &context_loc)?;

    let exception_stream = ExceptionStream {
        ThreadId: LittleEndian::read_u32(&raw[0..4]),
        Exception: exception_record,
        ThreadContext: context_loc,

        Context: context,
    };

    Ok((exception_stream, seek_remain))
}
