import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { 
  X, 
  Download, 
  Upload, 
  Copy, 
  Check, 
  AlertCircle, 
  Database,
  RefreshCw,
  Wifi,
  Laptop,
  Smartphone,
  ArrowLeftRight,
  Info,
  CheckCircle,
  QrCode,
  Image,
  Video,
  Music,
  FileText,
  FolderArchive,
  File,
  Trash2
} from "lucide-react";
import { useThemeStyles } from "@/lib/useThemeStyles";
import { exportDatabase, importDatabase, BACKUP_KEYS } from "@/lib/store";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function BackupModal({ isOpen, onClose, onSuccess }: Props) {
  const { bg, fg, fgMuted, cardBorder, inputBg } = useThemeStyles();
  const [activeTab, setActiveTab] = useState<"wifi" | "manual" | "files" | "auto">("wifi");
  const [copySuccess, setCopySuccess] = useState(false);
  const [importText, setImportText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // WiFi Sync States
  const [serverStatus, setServerStatus] = useState<"checking" | "connected" | "disconnected">("checking");
  const [networkIps, setNetworkIps] = useState<string[]>([]);
  const [port, setPort] = useState(3000);
  const [serverData, setServerData] = useState<any | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncDirection, setSyncDirection] = useState<string | null>(null);

  // WiFi File Sharing States
  const [sharedFiles, setSharedFiles] = useState<any[]>([]);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [isUploadingFile, setIsUploadingFile] = useState(false);

  // Auto Backup States
  const [autoBackups, setAutoBackups] = useState<any[]>([]);
  const [isLoadingAuto, setIsLoadingAuto] = useState(false);
  const [restoringSlot, setRestoringSlot] = useState<{ date: string; slot: number } | null>(null);

  const isHost = typeof window !== "undefined" && 
    (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");

  useEffect(() => {
    if (isOpen) {
      checkServerConnection();
      if (activeTab === "files") {
        fetchSharedFiles();
      } else if (activeTab === "auto") {
        fetchAutoBackups();
      }
    }
  }, [isOpen, activeTab]);

  const checkServerConnection = async () => {
    setServerStatus("checking");
    setError(null);
    try {
      // ۱. تایید ارتباط با نقطه پایانی دریافت دیتابیس سرور لپ‌تاپ
      const dbRes = await fetch("/api/db");
      if (!dbRes.ok) throw new Error("Server database endpoint not ok");
      const dbJson = await dbRes.json();
      setServerData(dbJson.data || {});

      // ۲. دریافت لیست آی‌پی‌های شبکه محلی سرور لپ‌تاپ
      const ipRes = await fetch("/api/network-ips");
      if (ipRes.ok) {
        const ipJson = await ipRes.json();
        setNetworkIps(ipJson.ips || []);
        setPort(ipJson.port || 3000);
      }
      
      setServerStatus("connected");
    } catch (err) {
      console.error("Failed to connect to local server:", err);
      setServerStatus("disconnected");
      setServerData(null);
    }
  };

  // دریافت لیست فایل‌های به اشتراک‌گذاشته شده روی لپ‌تاپ
  const fetchSharedFiles = async () => {
    setIsLoadingFiles(true);
    try {
      const res = await fetch("/api/shared-files");
      if (res.ok) {
        const json = await res.json();
        setSharedFiles(json.files || []);
      }
    } catch (err) {
      console.error("Error fetching shared files:", err);
    } finally {
      setIsLoadingFiles(false);
    }
  };

  // دریافت لیست بکاپ‌های خودکار سرور
  const fetchAutoBackups = async () => {
    setIsLoadingAuto(true);
    setError(null);
    try {
      const res = await fetch("/api/backups");
      if (res.ok) {
        const data = await res.json();
        setAutoBackups(data.backups || []);
      } else {
        throw new Error("خطا در پاسخ سرور");
      }
    } catch (err) {
      console.error("Failed to fetch auto backups:", err);
      setError("خطا در دریافت لیست بکاپ‌های خودکار سرور. از فعال بودن برنامه روی لپ‌تاپ مطمئن شوید.");
    } finally {
      setIsLoadingAuto(false);
    }
  };

  // بازیابی بکاپ روی دیتابیس اصلی سرور و همگام‌سازی آنی روی کلاینت
  const handleRestoreBackup = async (date: string, slot: number, timeLabel: string) => {
    if (!window.confirm(`آیا مطمئن هستید که می‌خواهید اطلاعات برنامه را به بکاپ تاریخ ${date} بازه ${timeLabel} بازیابی کنید؟ کل اطلاعات فعلی گوشی و لپ‌تاپ بازنویسی خواهد شد.`)) {
      return;
    }

    setRestoringSlot({ date, slot });
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await fetch("/api/backups/restore", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ date, slot })
      });

      if (!res.ok) {
        throw new Error("خطا در پاسخ سرور");
      }

      setSuccessMsg(`اطلاعات با موفقیت به تاریخ ${date} بازگردانده شد. در حال بازنشانی کلاینت...`);
      
      // پاک کردن دیتای کلاینت جهت همگام‌سازی تمیز از سرور و لود مجدد
      setTimeout(() => {
        localStorage.clear();
        window.location.reload();
      }, 1500);

    } catch (err) {
      console.error("Failed to restore backup:", err);
      setError("خطا در بازیابی اطلاعات بکاپ سرور.");
    } finally {
      setRestoringSlot(null);
    }
  };

  // ارسال فایل جدید به سرور لپ‌تاپ
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingFile(true);
    setError(null);
    setSuccessMsg(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/shared-files/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || "خطا در آپلود فایل");
      }

      setSuccessMsg(`فایل "${file.name}" با موفقیت به لپ‌تاپ فرستاده شد.`);
      fetchSharedFiles();
      setTimeout(() => setSuccessMsg(null), 3500);
    } catch (err: any) {
      setError(err.message || "خطا در ارسال فایل. حجم یا اتصال خود را بررسی کنید.");
    } finally {
      setIsUploadingFile(false);
      e.target.value = "";
    }
  };

  // حذف فیزیکی فایل از روی سرور لپ‌تاپ
  const handleFileDelete = async (filename: string) => {
    if (!window.confirm("آیا مطمئن هستید که می‌خواهید این فایل را از روی حافظه سرور لپ‌تاپ حذف کنید؟")) {
      return;
    }

    try {
      const res = await fetch(`/api/shared-files/${encodeURIComponent(filename)}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setSuccessMsg("فایل با موفقیت از روی سرور حذف شد.");
        fetchSharedFiles();
        setTimeout(() => setSuccessMsg(null), 3000);
      } else {
        const errJson = await res.json();
        throw new Error(errJson.error || "خطا در حذف فایل");
      }
    } catch (err: any) {
      setError(err.message || "خطا در حذف فایل.");
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const getFileIcon = (filename: string) => {
    const ext = filename.split(".").pop()?.toLowerCase();
    if (!ext) return <File className="h-4 w-4 text-gray-400" />;
    
    if (["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(ext)) {
      return <Image className="h-4 w-4 text-emerald-400" />;
    }
    if (["mp4", "mov", "avi", "mkv", "webm", "3gp"].includes(ext)) {
      return <Video className="h-4 w-4 text-rose-400" />;
    }
    if (["mp3", "wav", "m4a", "ogg", "flac"].includes(ext)) {
      return <Music className="h-4 w-4 text-sky-400" />;
    }
    if (["pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt", "md"].includes(ext)) {
      return <FileText className="h-4 w-4 text-amber-400" />;
    }
    if (["zip", "rar", "7z", "tar", "gz"].includes(ext)) {
      return <FolderArchive className="h-4 w-4 text-purple-400" />;
    }
    return <File className="h-4 w-4 text-blue-400" />;
  };

  if (!isOpen) return null;

  // Manual Export to JSON file
  const handleExportFile = () => {
    try {
      setError(null);
      const dataStr = exportDatabase();
      const blob = new Blob([dataStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const now = new Date();
      const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      const timeStr = `${String(now.getHours()).padStart(2, "0")}-${String(now.getMinutes()).padStart(2, "0")}`;
      
      a.href = url;
      a.download = `FocusFlow_Backup_${dateStr}_${timeStr}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      setSuccessMsg("فایل پشتیبان با موفقیت دانلود شد.");
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      setError("خطا در ایجاد و دانلود فایل پشتیبان.");
    }
  };

  // Manual Export to Text Code (Clipboard)
  const handleExportText = () => {
    try {
      setError(null);
      const dataStr = exportDatabase();
      const compressed = JSON.stringify(JSON.parse(dataStr));
      navigator.clipboard.writeText(compressed).then(() => {
        setCopySuccess(true);
        setSuccessMsg("کد پشتیبان با موفقیت در کلیپ‌بورد کپی شد.");
        setTimeout(() => {
          setCopySuccess(false);
          setSuccessMsg(null);
        }, 3000);
      });
    } catch (err) {
      setError("خطا در کپی کد پشتیبان.");
    }
  };

  // Manual Import from file
  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    setSuccessMsg(null);
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith(".json")) {
      setError("لطفاً یک فایل معتبر با پسوند .json انتخاب کنید.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const success = importDatabase(text);
        if (success) {
          window.dispatchEvent(new CustomEvent("focusflow-data-changed"));
          setSuccessMsg("اطلاعات با موفقیت بازیابی شد. در حال بارگذاری مجدد...");
          setTimeout(() => {
            onSuccess();
            onClose();
          }, 1500);
        } else {
          setError("فرمت اطلاعات داخل فایل معتبر نیست.");
        }
      } catch (err) {
        setError("خطا در خواندن فایل پشتیبان.");
      }
    };
    reader.readAsText(file);
  };

  // Manual Import from text paste
  const handleImportTextSubmit = () => {
    setError(null);
    setSuccessMsg(null);
    if (!importText.trim()) {
      setError("لطفاً ابتدا کد پشتیبان را در کادر زیر وارد کنید.");
      return;
    }

    try {
      const success = importDatabase(importText.trim());
      if (success) {
        window.dispatchEvent(new CustomEvent("focusflow-data-changed"));
        setSuccessMsg("اطلاعات با موفقیت بازیابی شد. در حال بارگذاری مجدد...");
        setImportText("");
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 1500);
      } else {
        setError("کد پشتیبان وارد شده معتبر نیست. لطفاً مجدداً بررسی کنید.");
      }
    } catch (err) {
      setError("کد وارد شده فرمت JSON معتبری ندارد.");
    }
  };

  // --- WiFi Synchronization Actions ---

  // Get current Local Database object
  const getLocalDataObj = () => {
    try {
      return JSON.parse(exportDatabase());
    } catch {
      return {};
    }
  };

  const localDataObj = getLocalDataObj();

  // Helper to count items in a data object
  const countItems = (data: any, key: string) => {
    if (!data || !data[key]) return 0;
    return Array.isArray(data[key]) ? data[key].length : 0;
  };

  // Upload: local localStorage -> server save/db.json
  const handleWifiUpload = async () => {
    if (serverStatus !== "connected") return;
    if (!window.confirm("آیا مطمئن هستید که می‌خواهید اطلاعات این مرورگر را به سرور لپ‌تاپ بفرستید؟ فایل قبلی روی لپ‌تاپ کاملاً جایگزین خواهد شد.")) {
      return;
    }

    setSyncing(true);
    setSyncDirection("upload");
    setError(null);

    try {
      const response = await fetch("/api/db", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ data: localDataObj })
      });

      if (!response.ok) {
        throw new Error("خطا در پاسخ سرور");
      }

      setSuccessMsg("اطلاعات با موفقیت به فایل لپ‌تاپ منتقل و ذخیره شد.");
      await checkServerConnection();
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      setError("خطا در ارسال اطلاعات به سرور لپ‌تاپ. اتصال وای‌فای خود را بررسی کنید.");
    } finally {
      setSyncing(false);
      setSyncDirection(null);
    }
  };

  // Download: server save/db.json -> local localStorage
  const handleWifiDownload = async () => {
    if (serverStatus !== "connected" || !serverData) return;
    if (!window.confirm("آیا مطمئن هستید که می‌خواهید اطلاعات را از لپ‌تاپ دریافت کنید؟ اطلاعات فعلی این مرورگر کاملاً پاک شده و جایگزین می‌شود.")) {
      return;
    }

    setSyncing(true);
    setSyncDirection("download");
    setError(null);

    try {
      const dbStr = JSON.stringify(serverData);
      const success = importDatabase(dbStr);

      if (success) {
        window.dispatchEvent(new CustomEvent("focusflow-data-changed"));
        setSuccessMsg("اطلاعات با موفقیت از لپ‌تاپ دریافت و اعمال شد. در حال بارگذاری مجدد...");
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 1500);
      } else {
        throw new Error("فرمت اطلاعات دریافتی نامعتبر بود");
      }
    } catch (err) {
      setError("خطا در اعمال اطلاعات دریافتی روی این دستگاه.");
    } finally {
      setSyncing(false);
      setSyncDirection(null);
    }
  };

  // Smart Merge: combine local localStorage and server save/db.json without duplicates
  const handleWifiMerge = async () => {
    if (serverStatus !== "connected" || !serverData) return;
    if (!window.confirm("آیا می‌خواهید اطلاعات لپ‌تاپ و این دستگاه را به صورت هوشمند ادغام کنید؟ هیچ اطلاعاتی پاک نشده و رکوردهای هر دو دستگاه ترکیب خواهند شد.")) {
      return;
    }

    setSyncing(true);
    setSyncDirection("merge");
    setError(null);

    try {
      const merged: any = { ...serverData, ...localDataObj };

      BACKUP_KEYS.forEach((key) => {
        const localArr = Array.isArray(localDataObj[key]) ? localDataObj[key] : [];
        const serverArr = Array.isArray(serverData[key]) ? serverData[key] : [];
        
        const map = new Map<string, any>();
        
        // ۱. ابتدا داده‌های این کلاینت را وارد نقشه می‌کنیم
        localArr.forEach((item: any) => {
          if (item && item.id) map.set(item.id, item);
        });

        // ۲. داده‌های لپ‌تاپ را ادغام می‌کنیم
        serverArr.forEach((item: any) => {
          if (item && item.id) {
            const existing = map.get(item.id);
            if (existing) {
              // مقایسه زمان ویرایش برای یادداشت‌ها
              if (key === "focusflow_notes" && existing.updated_at && item.updated_at) {
                if (item.updated_at > existing.updated_at) {
                  map.set(item.id, item);
                }
              } else {
                // ادغام خصوصیات مابقی موجودیت‌ها
                map.set(item.id, { ...existing, ...item });
              }
            } else {
              map.set(item.id, item);
            }
          }
        });

        merged[key] = Array.from(map.values());
      });

      // فیلدهای غیرآرایه‌ای مربوط به رتبه بالا رفتن
      merged["focusflow_going_up_settings"] = {
        ...(serverData["focusflow_going_up_settings"] || {}),
        ...(localDataObj["focusflow_going_up_settings"] || {})
      };
      merged["focusflow_going_up_state"] = {
        ...(serverData["focusflow_going_up_state"] || {}),
        ...(localDataObj["focusflow_going_up_state"] || {})
      };

      // تاریخ کنکور و امتحانات نهایی
      merged["focusflow_konkur_date"] = localDataObj["focusflow_konkur_date"] || serverData["focusflow_konkur_date"] || "2027-06-25";
      merged["focusflow_final_exams_date"] = localDataObj["focusflow_final_exams_date"] || serverData["focusflow_final_exams_date"] || "2027-05-20";
      merged["focusflow_active_preset_id"] = localDataObj["focusflow_active_preset_id"] || serverData["focusflow_active_preset_id"] || "default";
      merged["focusflow_safe_mode"] = localDataObj["focusflow_safe_mode"] !== undefined ? localDataObj["focusflow_safe_mode"] : (serverData["focusflow_safe_mode"] || "true");
      merged["focusflow-theme"] = localDataObj["focusflow-theme"] || serverData["focusflow-theme"] || "dark";

      // ذخیره‌سازی داده‌های ادغام شده روی کلاینت (localStorage)
      const mergedStr = JSON.stringify(merged);
      const localSuccess = importDatabase(mergedStr);

      if (!localSuccess) throw new Error("Failed to save merged data locally");

      // ارسال نسخه نهایی ادغام‌شده به سرور لپ‌تاپ جهت هماهنگی کامل فایل
      const serverResponse = await fetch("/api/db", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ data: merged })
      });

      if (!serverResponse.ok) throw new Error("Failed to sync merged data with server file");

      window.dispatchEvent(new CustomEvent("focusflow-data-changed"));
      setSuccessMsg("ادغام هوشمند اطلاعات با موفقیت انجام شد و هر دو دستگاه هماهنگ شدند!");
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1500);

    } catch (err) {
      setError("خطا در فرآیند ادغام اطلاعات شبکه محلی.");
    } finally {
      setSyncing(false);
      setSyncDirection(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md" dir="rtl">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="w-full max-w-lg rounded-3xl p-6 border shadow-2xl overflow-y-auto max-h-[90vh] scrollbar-thin"
        style={{ backgroundColor: bg, borderColor: cardBorder }}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b" style={{ borderColor: cardBorder }}>
          <div className="flex items-center gap-2">
            <Database className="h-5 w-5 text-amber-500" />
            <h3 className="text-sm font-bold" style={{ color: fg }}>پشتیبان‌گیری و انتقال اطلاعات</h3>
          </div>
          <button 
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex rounded-xl p-1 mt-4 gap-1" style={{ backgroundColor: inputBg }}>
          <button
            onClick={() => {
              setActiveTab("wifi");
              setError(null);
              setSuccessMsg(null);
            }}
            className={`flex-1 flex items-center justify-center gap-1 py-2 text-[10px] sm:text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
              activeTab === "wifi" 
                ? "bg-amber-500 text-white shadow-md" 
                : "text-gray-400 hover:text-white hover:bg-white/5"
            }`}
          >
            <Wifi className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
            <span>همگام‌سازی</span>
          </button>
          
          <button
            onClick={() => {
              setActiveTab("files");
              setError(null);
              setSuccessMsg(null);
              fetchSharedFiles();
            }}
            className={`flex-1 flex items-center justify-center gap-1 py-2 text-[10px] sm:text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
              activeTab === "files" 
                ? "bg-amber-500 text-white shadow-md" 
                : "text-gray-400 hover:text-white hover:bg-white/5"
            }`}
          >
            <Upload className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
            <span>تبادل فایل</span>
          </button>

          <button
            onClick={() => {
              setActiveTab("auto");
              setError(null);
              setSuccessMsg(null);
              fetchAutoBackups();
            }}
            className={`flex-1 flex items-center justify-center gap-1 py-2 text-[10px] sm:text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
              activeTab === "auto" 
                ? "bg-amber-500 text-white shadow-md" 
                : "text-gray-400 hover:text-white hover:bg-white/5"
            }`}
          >
            <RefreshCw className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
            <span>بکاپ خودکار</span>
          </button>

          <button
            onClick={() => {
              setActiveTab("manual");
              setError(null);
              setSuccessMsg(null);
            }}
            className={`flex-1 flex items-center justify-center gap-1 py-2 text-[10px] sm:text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
              activeTab === "manual" 
                ? "bg-amber-500 text-white shadow-md" 
                : "text-gray-400 hover:text-white hover:bg-white/5"
            }`}
          >
            <Download className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
            <span>بکاپ دستی</span>
          </button>
        </div>

        {/* Alerts */}
        {error && (
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-rose-500/20 bg-rose-500/5 p-3 text-xs font-semibold text-rose-400">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}
        {successMsg && (
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-xs font-semibold text-emerald-400">
            <CheckCircle className="h-4 w-4 flex-shrink-0 animate-pulse" />
            <span>{successMsg}</span>
          </div>
        )}

        {activeTab === "manual" ? (
          /* MANUAL TABS */
          <div className="mt-5 space-y-6">
            <div className="space-y-3">
              <h4 className="text-xs font-bold" style={{ color: fgMuted }}>۱. خروجی گرفتن و انتقال اطلاعات (Export)</h4>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={handleExportFile}
                  className="flex flex-col items-center justify-center gap-2 rounded-2xl border p-4 hover:bg-white/5 transition-all duration-200 cursor-pointer"
                  style={{ borderColor: cardBorder }}
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500">
                    <Download className="h-5 w-5" />
                  </div>
                  <span className="text-[11px] font-bold" style={{ color: fg }}>دانلود فایل بکاپ</span>
                  <span className="text-[9px]" style={{ color: fgMuted }}>فرمت .json</span>
                </button>

                <button
                  onClick={handleExportText}
                  className="flex flex-col items-center justify-center gap-2 rounded-2xl border p-4 hover:bg-white/5 transition-all duration-200 cursor-pointer"
                  style={{ borderColor: cardBorder }}
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-400">
                    {copySuccess ? <Check className="h-5 w-5 text-emerald-500" /> : <Copy className="h-5 w-5" />}
                  </div>
                  <span className="text-[11px] font-bold" style={{ color: fg }}>کپی متنی دیتابیس</span>
                  <span className="text-[9px]" style={{ color: fgMuted }}>انتقال سریع و آسان</span>
                </button>
              </div>
            </div>

            <div className="space-y-4 pt-4 border-t" style={{ borderColor: cardBorder }}>
              <h4 className="text-xs font-bold" style={{ color: fgMuted }}>۲. بازیابی و وارد کردن اطلاعات (Import)</h4>
              
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs" style={{ color: fg }}>بازیابی از فایل بکاپ:</span>
                <label 
                  className="flex items-center gap-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white px-3 py-1.5 text-xs font-bold cursor-pointer transition-colors"
                >
                  <Upload className="h-3.5 w-3.5" />
                  <span>انتخاب فایل</span>
                  <input 
                    type="file" 
                    accept=".json" 
                    onChange={handleImportFile}
                    className="hidden" 
                  />
                </label>
              </div>

              <div className="space-y-2">
                <span className="block text-xs" style={{ color: fg }}>بازیابی از کد متنی:</span>
                <textarea
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
                  placeholder="کد متنی کپی شده از دستگاه قبلی را اینجا پیست کنید..."
                  className="w-full h-16 rounded-xl p-2.5 text-[11px] outline-none border resize-none font-mono"
                  style={{ backgroundColor: inputBg, color: fg, borderColor: cardBorder }}
                />
                <button
                  onClick={handleImportTextSubmit}
                  className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white py-2 text-xs font-bold transition-colors cursor-pointer"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  <span>بروزرسانی اطلاعات از طریق کد</span>
                </button>
              </div>
            </div>
            
            <p className="text-[10px] text-center leading-relaxed" style={{ color: fgMuted }}>
              💡 با کپی کردن کد متنی، می‌توانید بدون دانلود فایل، دیتابیس خود را کپی کرده و روی هر گوشی یا سایتی انتقال داده و لود کنید.
            </p>
          </div>
        ) : activeTab === "files" ? (
          /* WIFI LOCAL FILE EXCHANGE TAB */
          <div className="mt-5 space-y-4">
            {/* Connection Status Panel */}
            <div 
              className="flex items-center justify-between p-3 rounded-2xl border text-xs"
              style={{ borderColor: cardBorder, backgroundColor: inputBg }}
            >
              <div className="flex items-center gap-2">
                <div className="relative flex h-2 w-2">
                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                    serverStatus === "connected" ? "bg-emerald-400" : "bg-rose-400"
                  }`}></span>
                  <span className={`relative inline-flex rounded-full h-2 w-2 ${
                    serverStatus === "connected" ? "bg-emerald-500" : "bg-rose-500"
                  }`}></span>
                </div>
                <span className="font-bold" style={{ color: fg }}>
                  {serverStatus === "connected" ? "اتصال به شبکه محلی برقرار است" : "عدم اتصال به سرور لپ‌تاپ"}
                </span>
              </div>
              <button
                onClick={fetchSharedFiles}
                disabled={serverStatus !== "connected" || isLoadingFiles}
                className="p-1 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors cursor-pointer disabled:opacity-40"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isLoadingFiles ? "animate-spin" : ""}`} />
              </button>
            </div>

            {serverStatus !== "connected" ? (
              <div className="p-5 rounded-2xl border border-rose-500/20 bg-rose-500/5 text-center space-y-3">
                <AlertCircle className="h-8 w-8 text-rose-400 mx-auto" />
                <h5 className="text-xs font-bold text-rose-400">اتصال بی‌سیم با لپ‌تاپ قطع است</h5>
                <p className="text-[10px] leading-relaxed" style={{ color: fgMuted }}>
                  برای فرستادن فیلم، عکس، داکیومنت و موزیک بین گوشی و لپ‌تاپ، ابتدا باید از روشن بودن برنامه روی لپ‌تاپ و اتصال هر دو دستگاه به یک شبکه وای‌فای خانگی مشترک اطمینان حاصل کنید.
                </p>
              </div>
            ) : (
              <>
                {/* Upload Section */}
                <div 
                  className="relative group border-2 border-dashed rounded-2xl p-5 text-center cursor-pointer hover:border-amber-500/50 transition-all"
                  style={{ borderColor: cardBorder, backgroundColor: inputBg }}
                >
                  <input
                    type="file"
                    onChange={handleFileUpload}
                    disabled={isUploadingFile}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                  <div className="flex flex-col items-center gap-2">
                    <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500">
                      {isUploadingFile ? (
                        <RefreshCw className="h-5 w-5 animate-spin" />
                      ) : (
                        <Upload className="h-5 w-5" />
                      )}
                    </div>
                    <span className="text-xs font-bold" style={{ color: fg }}>
                      {isUploadingFile ? "در حال ارسال فایل به لپ‌تاپ..." : "انتخاب یا رها کردن فایل برای ارسال"}
                    </span>
                    <span className="text-[10px]" style={{ color: fgMuted }}>
                      پشتیبانی از انواع فرمت‌های فیلم، عکس، آهنگ، سند و زیپ تا سقف ۲۵۰ مگابایت
                    </span>
                  </div>
                </div>

                {/* Shared Files List */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold" style={{ color: fgMuted }}>📦 فایل‌های موجود روی حافظه لپ‌تاپ:</span>
                    <span className="text-[10px] bg-amber-500/10 text-amber-400 px-2.5 py-0.5 rounded-full font-bold">
                      {sharedFiles.length} فایل
                    </span>
                  </div>

                  {isLoadingFiles ? (
                    <div className="flex justify-center py-6">
                      <RefreshCw className="h-6 w-6 text-amber-500 animate-spin" />
                    </div>
                  ) : sharedFiles.length === 0 ? (
                    <div className="border rounded-2xl py-8 text-center text-[11px]" style={{ borderColor: cardBorder, color: fgMuted }}>
                      هیچ فایلی هنوز ارسال نشده است. اولین فایل را ارسال کنید!
                    </div>
                  ) : (
                    <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-1 scrollbar-thin">
                      {sharedFiles.map((f) => (
                        <div 
                          key={f.filename}
                          className="flex items-center justify-between p-2.5 rounded-xl border hover:bg-white/5 transition-colors"
                          style={{ borderColor: cardBorder }}
                        >
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <div className="p-1.5 rounded-lg bg-white/5 flex-shrink-0">
                              {getFileIcon(f.originalName)}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-[11px] font-bold truncate pr-1" style={{ color: fg }} title={f.originalName}>
                                {f.originalName}
                              </p>
                              <p className="text-[9px] font-mono" style={{ color: fgMuted }}>
                                {formatBytes(f.size)} • {new Date(f.uploadedAt).toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" })}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-1">
                            {/* Download Button */}
                            <a
                              href={`/api/shared-files/download/${encodeURIComponent(f.filename)}`}
                              download={f.originalName}
                              className="p-1.5 rounded-lg hover:bg-white/10 text-emerald-400 transition-colors animate-pulse-slow"
                              title="دانلود مستقیم"
                            >
                              <Download className="h-3.5 w-3.5" />
                            </a>

                            {/* Delete Button */}
                            <button
                              onClick={() => handleFileDelete(f.filename)}
                              className="p-1.5 rounded-lg hover:bg-white/10 text-rose-400 hover:text-rose-300 transition-colors cursor-pointer"
                              title="حذف از روی سرور"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        ) : activeTab === "auto" ? (
          /* AUTO BACKUPS TAB */
          <div className="mt-5 space-y-4">
            {/* Connection Status Panel */}
            <div 
              className="flex items-center justify-between p-3 rounded-2xl border text-xs"
              style={{ borderColor: cardBorder, backgroundColor: inputBg }}
            >
              <div className="flex items-center gap-2">
                <div className="relative flex h-2 w-2">
                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                    serverStatus === "connected" ? "bg-emerald-400" : "bg-rose-400"
                  }`}></span>
                  <span className={`relative inline-flex rounded-full h-2 w-2 ${
                    serverStatus === "connected" ? "bg-emerald-500" : "bg-rose-500"
                  }`}></span>
                </div>
                <span className="font-bold" style={{ color: fg }}>
                  {serverStatus === "connected" ? "اتصال به شبکه محلی برقرار است" : "عدم اتصال به سرور لپ‌تاپ"}
                </span>
              </div>
              <button
                onClick={fetchAutoBackups}
                disabled={serverStatus !== "connected" || isLoadingAuto}
                className="p-1 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors cursor-pointer disabled:opacity-40"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isLoadingAuto ? "animate-spin" : ""}`} />
              </button>
            </div>

            {serverStatus !== "connected" ? (
              <div className="p-5 rounded-2xl border border-rose-500/20 bg-rose-500/5 text-center space-y-3">
                <AlertCircle className="h-8 w-8 text-rose-400 mx-auto" />
                <h5 className="text-xs font-bold text-rose-400">اتصال بی‌سیم با لپ‌تاپ قطع است</h5>
                <p className="text-[10px] leading-relaxed" style={{ color: fgMuted }}>
                  جهت دسترسی به تاریخچه‌ی بکاپ‌های خودکار و ۳ ساعته گذشته، ابتدا باید از روشن بودن برنامه روی لپ‌تاپ و اتصال به یک شبکه مشترک وای‌فای اطمینان حاصل کنید.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs font-bold" style={{ color: fgMuted }}>
                  <span>📅 لیست نسخه‌های پشتیبان خودکار ۱۰ روز اخیر سرور:</span>
                </div>

                {isLoadingAuto ? (
                  <div className="p-8 text-center" style={{ color: fgMuted }}>
                    <RefreshCw className="h-6 w-6 animate-spin mx-auto text-amber-500 mb-2" />
                    <span className="text-xs font-semibold">در حال دریافت لیست بکاپ‌های خودکار...</span>
                  </div>
                ) : autoBackups.length === 0 ? (
                  <div className="p-8 rounded-2xl border border-dashed text-center" style={{ borderColor: cardBorder, backgroundColor: inputBg }}>
                    <p className="text-xs text-gray-400 font-semibold">هیچ نسخه پشتیبان خودکاری روی سرور یافت نشد.</p>
                    <p className="text-[10px] text-gray-500 mt-1">بکاپ‌ها هر ۳ ساعت یکبار در صورت وجود اطلاعات ذخیره خواهند شد.</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1 scrollbar-thin">
                    {autoBackups.map((day) => (
                      <div 
                        key={day.date} 
                        className="border rounded-2xl p-3 space-y-2.5" 
                        style={{ borderColor: cardBorder, backgroundColor: inputBg }}
                      >
                        <div className="flex items-center justify-between border-b pb-1.5" style={{ borderColor: cardBorder }}>
                          <span className="text-xs font-bold text-amber-500 font-mono">{day.date}</span>
                          <span className="text-[10px] bg-white/5 text-gray-400 px-2 py-0.5 rounded-full font-bold">
                            {day.slots.length} بازه زمانی فعال
                          </span>
                        </div>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {day.slots.map((slot: any) => {
                            const isRestoring = restoringSlot?.date === day.date && restoringSlot?.slot === slot.slot;
                            return (
                              <div 
                                key={slot.slot} 
                                className="border rounded-xl p-2.5 flex flex-col justify-between gap-2 bg-black/10 hover:bg-black/20 transition-all text-right"
                                style={{ borderColor: cardBorder }}
                              >
                                <div>
                                  <div className="flex items-center justify-between text-[10px] font-bold">
                                    <span className="text-emerald-400 font-mono">بازه {slot.slot}</span>
                                    <span style={{ color: fgMuted }}>{slot.time}</span>
                                  </div>
                                  <p className="text-[9px] mt-1 text-gray-400 font-mono">
                                    حجم فایل: {(slot.size / 1024).toFixed(1)} KB
                                  </p>
                                </div>
                                
                                <button
                                  onClick={() => handleRestoreBackup(day.date, slot.slot, slot.time)}
                                  disabled={restoringSlot !== null}
                                  className="w-full py-1.5 px-2.5 rounded-lg text-[9px] sm:text-[10px] font-bold bg-amber-500/10 hover:bg-amber-500 hover:text-white text-amber-400 transition-all cursor-pointer disabled:opacity-40"
                                >
                                  {isRestoring ? "در حال بازیابی..." : "بازیابی اطلاعات به این زمان"}
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                
                <p className="text-[9px] leading-relaxed text-center" style={{ color: fgMuted }}>
                  ⚠️ توجه داشته باشید که بازگردانی بکاپ به معنی بارگذاری کل ساختار اطلاعات دیتابیس در زمان انتخابی است. با تایید شما، تمام کلاینت‌ها (گوشی‌ها) هم از این دیتابیس جدید تغذیه خواهند کرد.
                </p>
              </div>
            )}
          </div>
        ) : (
          /* WIFI LOCAL SYNC TAB */
          <div className="mt-5 space-y-5">
            {/* Connection Status Panel */}
            <div 
              className="flex items-center justify-between p-3.5 rounded-2xl border text-xs"
              style={{ borderColor: cardBorder, backgroundColor: inputBg }}
            >
              <div className="flex items-center gap-2">
                <div className={`relative flex h-3 w-3`}>
                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                    serverStatus === "connected" ? "bg-emerald-400" : serverStatus === "checking" ? "bg-amber-400" : "bg-rose-400"
                  }`}></span>
                  <span className={`relative inline-flex rounded-full h-3 w-3 ${
                    serverStatus === "connected" ? "bg-emerald-500" : serverStatus === "checking" ? "bg-amber-500" : "bg-rose-500"
                  }`}></span>
                </div>
                <span className="font-bold" style={{ color: fg }}>
                  {serverStatus === "connected" 
                    ? "اتصال به شبکه محلی برقرار است" 
                    : serverStatus === "checking" 
                    ? "در حال بررسی اتصال سرور..." 
                    : "عدم اتصال به سرور لپ‌تاپ"}
                </span>
              </div>
              <button
                onClick={checkServerConnection}
                className="flex items-center gap-1 text-[11px] bg-white/5 hover:bg-white/10 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                style={{ color: fg }}
              >
                <RefreshCw className="h-3 w-3 animate-spin-slow" />
                <span>بروزرسانی وضعیت</span>
              </button>
            </div>

            {/* If Not Connected Info */}
            {serverStatus === "disconnected" && (
              <div className="p-4 rounded-2xl border border-rose-500/20 bg-rose-500/5 space-y-2">
                <div className="flex items-center gap-2 text-rose-400 font-bold text-xs">
                  <AlertCircle className="h-4 w-4" />
                  <span>راهنمای حل مشکل اتصال:</span>
                </div>
                <ul className="text-[11px] list-disc list-inside space-y-1 text-gray-300 leading-relaxed pr-2">
                  <li>مطمئن شوید لپ‌تاپ شما روشن بوده و سرور برنامه در حال اجرا است.</li>
                  <li>مطمئن شوید گوشی موبایل و لپ‌تاپ به <b>یک مودم وای‌فای مشترک (یا هات‌اسپات)</b> وصل هستند.</li>
                  <li>فایروال (Firewall) لپ‌تاپ خود را به صورت موقت خاموش کنید تا اتصال پورت ۳۰۰۰ مسدود نشود.</li>
                </ul>
              </div>
            )}

            {/* Host Section: Displays IPs to connect from Mobile */}
            {serverStatus === "connected" && isHost && (
              <div className="p-4 rounded-2xl border space-y-4" style={{ borderColor: cardBorder }}>
                <div className="flex items-center gap-2">
                  <Laptop className="h-4 w-4 text-amber-500" />
                  <span className="text-xs font-bold" style={{ color: fg }}>این دستگاه: سرور اصلی (لپ‌تاپ)</span>
                </div>
                
                <p className="text-[11px] leading-relaxed" style={{ color: fgMuted }}>
                  برای انتقال اطلاعات به گوشی، ابتدا مطمئن شوید گوشی‌تان به همین وای‌فای وصل است. سپس با اسکن کد زیر یا وارد کردن این آدرس در مرورگر گوشی، برنامه را باز کنید:
                </p>

                <div className="flex flex-col sm:flex-row items-center gap-4 bg-white/5 p-3 rounded-2xl">
                  {/* Local IPs URLs */}
                  <div className="flex-1 space-y-2 w-full">
                    <span className="text-[10px] font-bold block" style={{ color: fgMuted }}>آدرس‌های اتصال مستقیم:</span>
                    {networkIps.length > 0 ? (
                      networkIps.map((ip) => {
                        const link = `http://${ip}:${port}`;
                        return (
                          <div key={ip} className="flex items-center justify-between gap-2 bg-black/30 px-2.5 py-1.5 rounded-xl border" style={{ borderColor: cardBorder }}>
                            <span className="font-mono text-[11px] select-all text-amber-400">{link}</span>
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(link);
                                alert("لینک کپی شد!");
                              }}
                              className="text-[10px] hover:text-white transition-colors cursor-pointer bg-white/10 px-1.5 py-0.5 rounded"
                              style={{ color: fg }}
                            >
                              کپی
                            </button>
                          </div>
                        );
                      })
                    ) : (
                      <span className="text-[11px] text-rose-400">آی‌پی شبکه محلی یافت نشد. به وای‌فای متصل شوید.</span>
                    )}
                  </div>

                  {/* Dynamic QR Code */}
                  {networkIps.length > 0 && (
                    <div className="flex flex-col items-center gap-1.5 bg-white p-2 rounded-2xl shadow-lg border self-center">
                      <img 
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=110x110&data=${encodeURIComponent(`http://${networkIps[0]}:${port}`)}`} 
                        alt="QR Connection Link"
                        className="w-24 h-24"
                        referrerPolicy="no-referrer"
                      />
                      <span className="text-[9px] text-slate-800 font-bold flex items-center gap-1">
                        <QrCode className="h-3 w-3" />
                        اسکن سریع با گوشی
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Mobile / Connected client view */}
            {serverStatus === "connected" && !isHost && (
              <div className="p-4 rounded-2xl border bg-indigo-500/5 space-y-2" style={{ borderColor: "rgba(99, 102, 241, 0.2)" }}>
                <div className="flex items-center gap-2">
                  <Smartphone className="h-4 w-4 text-indigo-400" />
                  <span className="text-xs font-bold text-indigo-300">این دستگاه: گوشی متصل (کلاینت)</span>
                </div>
                <p className="text-[11px] leading-relaxed" style={{ color: fg }}>
                  شما با موفقیت به صورت بی‌سیم به سرور لپ‌تاپ خود متصل شده‌اید! با دکمه‌های زیر می‌توانید اطلاعات را به صورت هوشمند ادغام کرده یا بین دستگاه‌ها منتقل کنید.
                </p>
              </div>
            )}

            {/* Comparison Grid */}
            {serverStatus === "connected" && (
              <div className="space-y-3">
                <span className="text-xs font-bold block" style={{ color: fgMuted }}>📊 مقایسه آماری داده‌های همگام‌سازی:</span>
                
                <div className="border rounded-2xl overflow-hidden" style={{ borderColor: cardBorder }}>
                  <div className="grid grid-cols-3 text-center text-[10px] font-bold p-2 bg-white/5 border-b" style={{ borderColor: cardBorder }}>
                    <div style={{ color: fgMuted }}>دسته‌بندی داده</div>
                    <div style={{ color: fg }}>این دستگاه (مرورگر)</div>
                    <div className="text-amber-400">لپ‌تاپ (سرور فایل)</div>
                  </div>
                  
                  <div className="divide-y text-center text-[11px]" style={{ borderColor: cardBorder }}>
                    {/* Tasks row */}
                    <div className="grid grid-cols-3 p-2">
                      <div className="font-bold" style={{ color: fgMuted }}>📋 تسک‌ها و فعالیت‌ها</div>
                      <div className="font-bold" style={{ color: fg }}>{countItems(localDataObj, "focusflow_tasks")}</div>
                      <div className="font-bold text-amber-500">{countItems(serverData, "focusflow_tasks")}</div>
                    </div>

                    {/* Notes row */}
                    <div className="grid grid-cols-3 p-2">
                      <div className="font-bold" style={{ color: fgMuted }}>📝 یادداشت‌ها</div>
                      <div className="font-bold" style={{ color: fg }}>{countItems(localDataObj, "focusflow_notes")}</div>
                      <div className="font-bold text-amber-500">{countItems(serverData, "focusflow_notes")}</div>
                    </div>

                    {/* Quiz Tracker row */}
                    <div className="grid grid-cols-3 p-2">
                      <div className="font-bold" style={{ color: fgMuted }}>🎯 ردیاب تست (امتحان)</div>
                      <div className="font-bold" style={{ color: fg }}>{countItems(localDataObj, "focusflow_quiz_entries")}</div>
                      <div className="font-bold text-amber-500">{countItems(serverData, "focusflow_quiz_entries")}</div>
                    </div>

                    {/* Habits row */}
                    <div className="grid grid-cols-3 p-2">
                      <div className="font-bold" style={{ color: fgMuted }}>⭐️ عادات روزانه</div>
                      <div className="font-bold" style={{ color: fg }}>{countItems(localDataObj, "focusflow_habits")}</div>
                      <div className="font-bold text-amber-500">{countItems(serverData, "focusflow_habits")}</div>
                    </div>

                    {/* Timeline row */}
                    <div className="grid grid-cols-3 p-2">
                      <div className="font-bold" style={{ color: fgMuted }}>⏱️ زمان‌بندی و تایملاین</div>
                      <div className="font-bold" style={{ color: fg }}>{countItems(localDataObj, "focusflow_timeline_entries")}</div>
                      <div className="font-bold text-amber-500">{countItems(serverData, "focusflow_timeline_entries")}</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Sync Action Buttons */}
            {serverStatus === "connected" && (
              <div className="space-y-3 pt-3 border-t" style={{ borderColor: cardBorder }}>
                {/* 1. Smart Merge Button */}
                <button
                  onClick={handleWifiMerge}
                  disabled={syncing}
                  className="w-full flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white py-3.5 text-xs font-bold shadow-lg shadow-amber-500/10 transition-all duration-200 cursor-pointer disabled:opacity-50"
                >
                  <ArrowLeftRight className={`h-4 w-4 ${syncing && syncDirection === "merge" ? "animate-spin" : ""}`} />
                  <span>
                    {syncing && syncDirection === "merge" 
                      ? "در حال ادغام هوشمند داده‌ها..." 
                      : "ادغام هوشمند اطلاعات دو دستگاه (توصیه شده)"}
                  </span>
                </button>

                <div className="grid grid-cols-2 gap-3">
                  {/* 2. Download from server */}
                  <button
                    onClick={handleWifiDownload}
                    disabled={syncing || !serverData}
                    className="flex flex-col items-center justify-center gap-1.5 rounded-2xl border p-3 hover:bg-white/5 transition-all duration-200 cursor-pointer disabled:opacity-50"
                    style={{ borderColor: cardBorder }}
                  >
                    <Download className={`h-4.5 w-4.5 text-indigo-400 ${syncing && syncDirection === "download" ? "animate-bounce" : ""}`} />
                    <span className="text-[11px] font-bold" style={{ color: fg }}>دریافت از لپ‌تاپ</span>
                    <span className="text-[9px]" style={{ color: fgMuted }}>رونویسی کامل این دستگاه</span>
                  </button>

                  {/* 3. Upload to server */}
                  <button
                    onClick={handleWifiUpload}
                    disabled={syncing}
                    className="flex flex-col items-center justify-center gap-1.5 rounded-2xl border p-3 hover:bg-white/5 transition-all duration-200 cursor-pointer disabled:opacity-50"
                    style={{ borderColor: cardBorder }}
                  >
                    <Upload className={`h-4.5 w-4.5 text-emerald-400 ${syncing && syncDirection === "upload" ? "animate-bounce" : ""}`} />
                    <span className="text-[11px] font-bold" style={{ color: fg }}>ارسال به لپ‌تاپ</span>
                    <span className="text-[9px]" style={{ color: fgMuted }}>رونویسی کامل دیتابیس لپ‌تاپ</span>
                  </button>
                </div>

                <div className="flex gap-1.5 p-3 rounded-2xl bg-amber-500/5 border border-amber-500/10 text-[10px] leading-relaxed text-amber-500/80">
                  <Info className="h-4 w-4 flex-shrink-0 mt-0.5" />
                  <span>
                    <b>💡 پیشنهاد:</b> از دکمه <b>ادغام هوشمند</b> استفاده کنید تا فعالیت‌ها و تسک‌های گوشی و لپ‌تاپ بدون حذف با هم ترکیب شوند. رونویسی ساده فقط برای شرایطی است که می‌خواهید یکی از دیتابیس‌ها را کلا حذف و دیگری را جایگزین کنید.
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </motion.div>
    </div>
  );
}
