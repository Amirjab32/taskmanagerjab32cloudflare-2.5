import { useState, useEffect, useRef } from "react";
import { 
  Notebook, 
  Plus, 
  Trash2, 
  Search, 
  Pin, 
  Copy, 
  Check, 
  Calendar,
  X,
  ChevronLeft,
  Bold,
  Clock,
  ListTodo,
  CheckSquare,
  Edit3
} from "lucide-react";
import { Note } from "@/lib/store";
import { toShamsiShort, toPersianDigits, todayShamsiShort } from "@/lib/shamsi";
import { useThemeStyles } from "@/lib/useThemeStyles";

interface Props {
  notes: Note[];
  onAdd: (data: { title: string; content: string; folder: string; tags: string[] }) => void;
  onUpdate: (id: string, data: Partial<Note>) => void;
  onDelete: (id: string) => void;
}

// Calculate checklist counts
function getChecklistStats(content: string) {
  const lines = (content || "").split("\n");
  let total = 0;
  let done = 0;
  for (const line of lines) {
    const match = line.match(/^\s*(☐|☑|\[ \]|\[x\]|- \[ \]| - \[x\])/i);
    if (match) {
      total++;
      if (match[1] === "☑" || match[1].toLowerCase().includes("x")) {
        done++;
      }
    }
  }
  return { total, done, hasChecklist: total > 0 };
}

export default function NotesView({ notes, onAdd, onUpdate, onDelete }: Props) {
  const { fg, fgMuted, cardBorder, inputBg, bg } = useThemeStyles();
  
  // States
  const [searchQuery, setSearchQuery] = useState("");
  const [activeNoteId, setActiveNoteId] = useState<string | null>(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem("focusflow_active_note_id") : null;
    if (saved && notes.some((n) => n.id === saved)) {
      return saved;
    }
    return notes.length > 0 ? notes[0].id : null;
  });
  const [showMobileEditor, setShowMobileEditor] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [interactiveMode, setInteractiveMode] = useState<boolean>(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem("focusflow_active_note_id") : null;
    const target = (saved && notes.find((n) => n.id === saved)) || (notes.length > 0 ? notes[0] : null);
    return target ? getChecklistStats(target.content).hasChecklist : false;
  });

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const activeNote = notes.find((n) => n.id === activeNoteId) || null;

  // Auto-select first note if none is active or if active note was deleted
  useEffect(() => {
    if (notes.length > 0) {
      const activeExists = notes.some((n) => n.id === activeNoteId);
      if (!activeExists) {
        const nextId = notes[0].id;
        setActiveNoteId(nextId);
        setShowMobileEditor(false);
        setInteractiveMode(getChecklistStats(notes[0].content).hasChecklist);
      }
    } else {
      setActiveNoteId(null);
      setShowMobileEditor(false);
      setInteractiveMode(false);
    }
  }, [notes, activeNoteId]);

  // Default to ticking/interactive mode when switching to or re-opening a note with checklist items
  useEffect(() => {
    if (activeNoteId) {
      if (typeof window !== "undefined") {
        localStorage.setItem("focusflow_active_note_id", activeNoteId);
      }
      const note = notes.find((n) => n.id === activeNoteId);
      if (note && getChecklistStats(note.content).hasChecklist) {
        setInteractiveMode(true);
        return;
      }
    }
    setInteractiveMode(false);
  }, [activeNoteId]);

  const checklistStats = activeNote ? getChecklistStats(activeNote.content) : { total: 0, done: 0, hasChecklist: false };

  // Helper to insert text at textarea cursor
  const insertAtCursor = (textToInsert: string) => {
    if (!activeNote) return;
    const textarea = textareaRef.current;
    if (!textarea) {
      onUpdate(activeNote.id, { content: (activeNote.content || "") + "\n" + textToInsert });
      return;
    }

    const start = textarea.selectionStart ?? activeNote.content.length;
    const end = textarea.selectionEnd ?? activeNote.content.length;
    const content = activeNote.content || "";
    const before = content.substring(0, start);
    const after = content.substring(end);

    const needsNewlineBefore = start > 0 && before[before.length - 1] !== "\n";
    const formattedInsert = (needsNewlineBefore ? "\n" : "") + textToInsert;

    const newContent = before + formattedInsert + after;
    onUpdate(activeNote.id, { content: newContent });

    setTimeout(() => {
      textarea.focus();
      const newPos = start + formattedInsert.length;
      textarea.setSelectionRange(newPos, newPos);
    }, 20);
  };

  // Insert current timestamp
  const handleInsertTimestamp = () => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const timeStr = toPersianDigits(`${pad(now.getHours())}:${pad(now.getMinutes())}`);
    const dateStr = todayShamsiShort();
    const stamp = `🕒 [${dateStr} | ${timeStr}] `;
    insertAtCursor(stamp);
  };

  // Insert checklist item
  const handleInsertChecklist = () => {
    insertAtCursor("☐ ");
  };

  // Auto-continue checklist on Enter
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter") {
      const textarea = textareaRef.current;
      if (!textarea) return;
      const pos = textarea.selectionStart;
      const content = activeNote?.content || "";
      
      const lastNewline = content.lastIndexOf("\n", pos - 1);
      const lineStart = lastNewline === -1 ? 0 : lastNewline + 1;
      const currentLine = content.substring(lineStart, pos);
      
      const match = currentLine.match(/^(\s*)(☐|☑|\[ \]|\[x\]|- \[ \]| - \[x\])\s*(.*)$/i);
      if (match) {
        e.preventDefault();
        const indent = match[1];
        const rest = match[3];
        
        if (!rest.trim()) {
          const beforeLine = content.substring(0, lineStart);
          const afterPos = content.substring(pos);
          const newContent = beforeLine + afterPos;
          onUpdate(activeNote!.id, { content: newContent });
          setTimeout(() => {
            textarea.setSelectionRange(lineStart, lineStart);
          }, 10);
          return;
        }
        
        const prefix = `${indent}☐ `;
        const before = content.substring(0, pos);
        const after = content.substring(pos);
        const newContent = `${before}\n${prefix}${after}`;
        onUpdate(activeNote!.id, { content: newContent });
        setTimeout(() => {
          const newPos = pos + 1 + prefix.length;
          textarea.setSelectionRange(newPos, newPos);
        }, 10);
      }
    }
  };

  // Toggle checklist item in interactive mode
  const toggleChecklistLine = (lineIndex: number) => {
    if (!activeNote) return;
    const lines = (activeNote.content || "").split("\n");
    if (lineIndex < 0 || lineIndex >= lines.length) return;
    
    const line = lines[lineIndex];
    const match = line.match(/^(\s*)(☐|☑|\[ \]|\[x\]|- \[ \]| - \[x\])\s*(.*)$/i);
    if (!match) return;

    const indent = match[1];
    const marker = match[2];
    const rest = match[3];

    const isChecked = marker === "☑" || marker.toLowerCase().includes("x");
    const newMarker = isChecked ? "☐" : "☑";
    lines[lineIndex] = `${indent}${newMarker} ${rest}`;

    onUpdate(activeNote.id, { content: lines.join("\n") });
  };

  // Render text line with timestamps as graphical badges
  const renderLineWithBadges = (text: string) => {
    const timestampRegex = /(?:🕒\s*)?\[\s*([۰-۹\d]{4}\/[۰-۹\d]{1,2}\/[۰-۹\d]{1,2})\s*[\|\-،]\s*([۰-۹\d]{1,2}:[۰-۹\d]{1,2}(?:\s*(?:صبح|عصر|ق\.ظ|ب\.ظ))?)\s*\]/g;
    const elements = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = timestampRegex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        elements.push(text.substring(lastIndex, match.index));
      }
      const datePart = match[1];
      const timePart = match[2];
      elements.push(
        <span
          key={match.index}
          className="inline-flex items-center gap-1 px-2 py-0.5 mx-1 rounded-md bg-amber-500/10 text-amber-500 border border-amber-500/25 text-[11px] font-medium align-middle select-none shadow-xs"
        >
          <Clock className="h-3 w-3 text-amber-500 shrink-0" />
          <span>{datePart}</span>
          <span className="opacity-40">|</span>
          <span>{timePart}</span>
        </span>
      );
      lastIndex = timestampRegex.lastIndex;
    }

    if (lastIndex < text.length) {
      elements.push(text.substring(lastIndex));
    }

    return elements.length > 0 ? elements : text;
  };

  // Handle note creation
  const handleCreateNote = () => {
    setInteractiveMode(false);
    onAdd({
      title: "یادداشت جدید",
      content: "",
      folder: "all",
      tags: [],
    });
    
    // Auto focus and open on mobile
    setTimeout(() => {
      if (notes.length > 0) {
        setActiveNoteId(notes[0].id);
      }
      setShowMobileEditor(true);
      setInteractiveMode(false);
    }, 60);
  };

  // Filter notes by search query
  const filteredNotes = notes.filter((note) => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = note.title.toLowerCase().includes(q);
      const matchContent = note.content.toLowerCase().includes(q);
      return matchTitle || matchContent;
    }
    return true;
  });

  // Copy note helper
  const handleCopyNote = () => {
    if (!activeNote) return;
    const fullText = `${activeNote.title}\n\n${activeNote.content}`;
    navigator.clipboard.writeText(fullText).then(() => {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 1500);
    });
  };

  const getWordCount = (str: string) => {
    const clean = str.trim();
    return clean ? clean.split(/\s+/).length : 0;
  };

  return (
    <div className="mx-auto max-w-4xl" dir="rtl">
      <div 
        className="grid grid-cols-1 md:grid-cols-12 overflow-hidden rounded-2xl border"
        style={{ borderColor: cardBorder, height: "72vh", backgroundColor: bg }}
      >
        
        {/* COLUMN 1: MINIMALIST SIDEBAR (Notes List) */}
        <div 
          className={`md:col-span-4 border-l flex flex-col h-full overflow-hidden ${showMobileEditor ? "hidden md:flex" : "flex"}`}
          style={{ borderColor: cardBorder }}
        >
          {/* Header & Quick Search */}
          <div className="p-4 space-y-3 border-b" style={{ borderColor: cardBorder }}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold tracking-wide uppercase opacity-75" style={{ color: fgMuted }}>یادداشت‌ها</span>
              <button
                onClick={handleCreateNote}
                className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500 hover:bg-amber-600 text-white transition-colors cursor-pointer shadow-sm"
                title="یادداشت جدید"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>

            {/* Apple Notes style minimalist search input */}
            <div 
              className="flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs border" 
              style={{ backgroundColor: inputBg, borderColor: cardBorder }}
            >
              <Search className="h-3.5 w-3.5 opacity-60" style={{ color: fgMuted }} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="جستجو..."
                className="w-full bg-transparent outline-none text-xs"
                style={{ color: fg }}
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery("")} className="text-gray-400 hover:text-white cursor-pointer">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Minimalist Cards List */}
          <div className="flex-1 overflow-y-auto divide-y" style={{ borderColor: cardBorder }}>
            {filteredNotes.length === 0 ? (
              <div className="py-16 text-center text-xs opacity-60" style={{ color: fgMuted }}>
                یادداشتی وجود ندارد
              </div>
            ) : (
              filteredNotes.map((note) => {
                const isActive = note.id === activeNoteId;
                const stats = getChecklistStats(note.content);
                const previewText = note.content.trim() 
                  ? note.content.trim().substring(0, 40) + (note.content.length > 40 ? "..." : "")
                  : "بدون متن";

                return (
                  <div
                    key={note.id}
                    onClick={() => {
                      setActiveNoteId(note.id);
                      setShowMobileEditor(true);
                      if (stats.hasChecklist) {
                        setInteractiveMode(true);
                      }
                    }}
                    className="w-full text-right p-3.5 transition-all cursor-pointer relative group block border-r-2"
                    style={{
                      borderRightColor: isActive ? "#f59e0b" : "transparent",
                      backgroundColor: isActive ? "rgba(245,158,11,0.04)" : "transparent"
                    }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <h4 
                        className={`text-xs font-bold truncate flex-1`}
                        style={{ color: isActive ? "#f59e0b" : fg }}
                      >
                        {note.title || "بدون عنوان"}
                      </h4>
                      <div className="flex items-center gap-1 shrink-0 text-[10px] opacity-60" style={{ color: fgMuted }}>
                        {note.is_pinned && (
                          <Pin className="h-3 w-3 text-amber-500 fill-amber-500" />
                        )}
                        <span>
                          {toPersianDigits(toShamsiShort(note.created_date))}
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-1.5 mt-1">
                      {stats.hasChecklist && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] font-mono text-amber-500 bg-amber-500/10 px-1.5 py-0.2 rounded border border-amber-500/20 shrink-0">
                          <CheckSquare className="h-2.5 w-2.5" />
                          <span>{toPersianDigits(stats.done)}/{toPersianDigits(stats.total)}</span>
                        </span>
                      )}
                      <p className={`text-[11px] truncate opacity-70 flex-1 ${note.is_bold ? "font-bold text-amber-500/90" : ""}`} style={{ color: note.is_bold ? undefined : fgMuted }}>
                        {previewText}
                      </p>
                    </div>

                    {/* Minimalist delete on hover */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(note.id);
                      }}
                      className="absolute left-3 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 p-1 rounded-md bg-rose-500/10 hover:bg-rose-500 text-rose-400 hover:text-white transition-all cursor-pointer"
                      title="حذف یادداشت"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* COLUMN 2: ZEN EDITOR WORKSPACE */}
        <div 
          className={`md:col-span-8 flex flex-col h-full overflow-hidden ${showMobileEditor ? "flex" : "hidden md:flex"}`}
        >
          {activeNote ? (
            <>
              {/* Workspace Simple Top Bar */}
              <div 
                className="px-4 py-3 flex items-center justify-between border-b"
                style={{ borderColor: cardBorder }}
              >
                {/* Back to list on mobile */}
                <button
                  onClick={() => setShowMobileEditor(false)}
                  className="md:hidden flex items-center gap-1 text-xs font-bold"
                  style={{ color: fg }}
                >
                  <ChevronLeft className="h-4 w-4" />
                  <span>یادداشت‌ها</span>
                </button>

                {/* Left Side utilities */}
                <div className="flex items-center gap-1 sm:gap-1.5 mr-auto">
                  {/* دکمه درج تاریخ و ساعت جاری */}
                  <button
                    onClick={handleInsertTimestamp}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all hover:bg-amber-500/15 text-amber-500 cursor-pointer border border-amber-500/30 shadow-xs"
                    title="درج تاریخ و ساعت فعلی در موقعیت مکان‌نما"
                  >
                    <Clock className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline text-[11px]">زمان فعلی</span>
                  </button>

                  {/* دکمه درج چک‌لیست */}
                  <button
                    onClick={handleInsertChecklist}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all hover:bg-amber-500/15 text-amber-500 cursor-pointer border border-amber-500/30 shadow-xs"
                    title="درج سطر چک‌لیست جدید"
                  >
                    <ListTodo className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline text-[11px]">چک‌لیست</span>
                  </button>

                  {/* دکمه حالت تعاملی و تیک‌زدن */}
                  <button
                    onClick={() => setInteractiveMode(!interactiveMode)}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer border ${
                      interactiveMode 
                        ? "bg-amber-500 text-white border-amber-500 shadow-sm" 
                        : "hover:bg-white/5 border-white/10 text-amber-400"
                    }`}
                    title={interactiveMode ? "بازگشت به ویرایشگر متنی" : "حالت مطالعه و تیک‌زدن چک‌لیست"}
                  >
                    {interactiveMode ? <Edit3 className="h-3.5 w-3.5" /> : <CheckSquare className="h-3.5 w-3.5" />}
                    <span className="hidden sm:inline text-[11px]">{interactiveMode ? "ویرایش" : "تیک‌زدن"}</span>
                  </button>

                  <div className="h-4 w-[1px] bg-white/10 mx-0.5" />

                  <button
                    onClick={() => onUpdate(activeNote.id, { is_bold: !activeNote.is_bold })}
                    className="p-1.5 rounded-lg transition-colors cursor-pointer hover:bg-white/5"
                    style={{ color: activeNote.is_bold ? "#f59e0b" : fgMuted }}
                    title={activeNote.is_bold ? "حذف حالت بولد" : "حالت بولد یادداشت"}
                  >
                    <Bold className={`h-4 w-4 ${activeNote.is_bold ? "text-amber-500 font-bold" : ""}`} />
                  </button>

                  <button
                    onClick={() => onUpdate(activeNote.id, { is_pinned: !activeNote.is_pinned })}
                    className="p-1.5 rounded-lg transition-colors cursor-pointer hover:bg-white/5"
                    style={{ color: activeNote.is_pinned ? "#f59e0b" : fgMuted }}
                    title={activeNote.is_pinned ? "برداشتن پین" : "پین کردن یادداشت"}
                  >
                    <Pin className={`h-4 w-4 ${activeNote.is_pinned ? "fill-amber-500 text-amber-500" : ""}`} />
                  </button>
                  
                  <button
                    onClick={handleCopyNote}
                    className="p-1.5 rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
                    style={{ color: copySuccess ? "#10b981" : fgMuted }}
                    title="کپی متن"
                  >
                    {copySuccess ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                  </button>

                  <button
                    onClick={() => {
                      onDelete(activeNote.id);
                    }}
                    className="p-1.5 rounded-lg hover:bg-rose-500/10 text-rose-400 transition-colors cursor-pointer"
                    title="حذف یادداشت"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Pure Elegant Zen Canvas */}
              <div className="flex-1 flex flex-col p-6 space-y-4 overflow-y-auto">
                <input
                  type="text"
                  value={activeNote.title}
                  onChange={(e) => onUpdate(activeNote.id, { title: e.target.value })}
                  placeholder="عنوان یادداشت..."
                  className="w-full bg-transparent text-lg font-bold outline-none border-b pb-2 tracking-tight"
                  style={{ color: fg, borderColor: `${cardBorder}33` }}
                />

                {!interactiveMode ? (
                  <>
                    {/* Minimal banner when checklist exists */}
                    {checklistStats.hasChecklist && (
                      <div 
                        onClick={() => setInteractiveMode(true)}
                        className="flex items-center justify-between px-3.5 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs cursor-pointer hover:bg-amber-500/15 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <CheckSquare className="h-4 w-4 text-amber-500" />
                          <span className="font-semibold text-amber-500">
                            چک‌لیست: {toPersianDigits(checklistStats.done)} از {toPersianDigits(checklistStats.total)} مورد تیک خورده است
                          </span>
                        </div>
                        <span className="text-[11px] text-amber-500 font-bold underline">
                          ورود به حالت تیک‌زدن ←
                        </span>
                      </div>
                    )}

                    <textarea
                      ref={textareaRef}
                      value={activeNote.content}
                      onChange={(e) => onUpdate(activeNote.id, { content: e.target.value })}
                      onKeyDown={handleKeyDown}
                      placeholder="شروع به تایپ کنید..."
                      className={`w-full flex-1 bg-transparent resize-none outline-none text-sm leading-relaxed ${activeNote.is_bold ? "font-bold" : ""}`}
                      style={{ color: fg }}
                    />
                  </>
                ) : (
                  <>
                    {/* Interactive Banner */}
                    <div className="flex items-center justify-between px-3.5 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs">
                      <div className="flex items-center gap-2">
                        <CheckSquare className="h-4 w-4 text-amber-500" />
                        <span className="font-semibold text-amber-500">
                          {checklistStats.hasChecklist 
                            ? `پیشرفت چک‌لیست: ${toPersianDigits(checklistStats.done)} از ${toPersianDigits(checklistStats.total)} (${toPersianDigits(Math.round((checklistStats.done / (checklistStats.total || 1)) * 100))}٪)`
                            : "حالت مطالعه تعاملی و نمایش گرافیکی تاریخ‌ها"}
                        </span>
                      </div>
                      <button
                        onClick={() => setInteractiveMode(false)}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500 text-white font-bold text-[11px] transition-colors shadow-xs hover:bg-amber-600 cursor-pointer"
                      >
                        <Edit3 className="h-3 w-3" />
                        <span>ویرایش متن</span>
                      </button>
                    </div>

                    {/* Interactive lines list */}
                    <div className={`flex-1 space-y-1.5 leading-relaxed text-sm ${activeNote.is_bold ? "font-bold" : ""}`} style={{ color: fg }}>
                      {activeNote.content.split("\n").map((line, idx) => {
                        const match = line.match(/^(\s*)(☐|☑|\[ \]|\[x\]|- \[ \]| - \[x\])\s*(.*)$/i);
                        if (match) {
                          const isChecked = match[2] === "☑" || match[2].toLowerCase().includes("x");
                          const text = match[3];
                          return (
                            <div 
                              key={idx}
                              className="flex items-start gap-2.5 group py-1 px-2 rounded-lg hover:bg-white/5 transition-colors cursor-pointer select-none"
                              onClick={() => toggleChecklistLine(idx)}
                            >
                              <button
                                type="button"
                                className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-all cursor-pointer ${
                                  isChecked
                                    ? "bg-amber-500 border-amber-500 text-white"
                                    : "border-gray-400/50 hover:border-amber-500"
                                }`}
                              >
                                {isChecked && <Check className="h-3 w-3 stroke-[3]" />}
                              </button>
                              <div className={`flex-1 ${isChecked ? "line-through opacity-50" : ""}`}>
                                {renderLineWithBadges(text)}
                              </div>
                            </div>
                          );
                        }

                        if (!line.trim()) {
                          return <div key={idx} className="h-3" />;
                        }

                        return (
                          <div key={idx} className="py-0.5 px-2">
                            {renderLineWithBadges(line)}
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>

              {/* Status footer bar */}
              <div 
                className="px-5 py-2.5 border-t flex items-center justify-between text-[10px]"
                style={{ borderColor: cardBorder, backgroundColor: "rgba(128,128,128,0.01)" }}
              >
                <span style={{ color: fgMuted }}>
                  {toPersianDigits(getWordCount(activeNote.content))} کلمه
                </span>
                <div className="flex items-center gap-1 opacity-70" style={{ color: fgMuted }}>
                  <Calendar className="h-3 w-3" />
                  <span>آخرین ویرایش: {toPersianDigits(new Date(activeNote.updated_at).toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" }))}</span>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 space-y-3">
              <Notebook className="h-10 w-10 opacity-20" />
              <p className="text-xs opacity-60" style={{ color: fgMuted }}>هیچ یادداشتی باز نیست</p>
              <button
                onClick={handleCreateNote}
                className="rounded-lg bg-amber-500 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-amber-600 transition-colors shadow-sm"
              >
                ایجاد یادداشت جدید
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
