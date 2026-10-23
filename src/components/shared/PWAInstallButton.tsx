import React, { useState } from "react";
import { Download, Smartphone, X } from "lucide-react";
import { usePWAInstall } from "@/lib/usePWAInstall";

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  // If already running as an installed PWA, hide the button
  if (isInstalled) {
    return null;
  }

  // Chromium / Android / Desktop flow
  if (isInstallable) {
    return (
      <button
        onClick={install}
        className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-amber-500 to-amber-600 px-3 py-1.5 text-[11px] font-bold text-white shadow-sm hover:from-amber-600 hover:to-amber-700 transition active:scale-95 cursor-pointer"
        title="نصب اپلیکیشن روی دستگاه"
      >
        <Download className="h-3.5 w-3.5 animate-bounce" />
        <span>نصب برنامه (PWA)</span>
      </button>
    );
  }

  // iOS Safari flow
  if (isIOS) {
    return (
      <>
        <button
          onClick={() => setShowIOSGuide(true)}
          className="flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-[11px] font-bold text-amber-400 hover:bg-amber-500/20 transition cursor-pointer"
          title="نصب در آیفون"
        >
          <Smartphone className="h-3.5 w-3.5" />
          <span>نصب در iOS</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" dir="rtl">
            <div className="w-full max-w-sm rounded-2xl bg-[#18181b] border border-zinc-800 p-6 shadow-2xl text-right">
              <div className="flex items-center justify-between mb-4 border-b border-zinc-800 pb-3">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Smartphone className="h-4 w-4 text-amber-400" />
                  <span>نصب روی آیفون و آیپد (iOS)</span>
                </h3>
                <button
                  onClick={() => setShowIOSGuide(false)}
                  className="p-1 rounded-lg text-zinc-400 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="space-y-3 text-xs text-zinc-300 leading-relaxed">
                <p>
                  ۱. در نوار پایین مرورگر سافاری، دکمه <strong>اشتراک‌گذاری (Share ⎋)</strong> را بزنید.
                </p>
                <p>
                  ۲. در منوی باز شده به پایین اسکرول کرده و گزینه <strong>Add to Home Screen (افزودن به صفحه اصلی)</strong> را انتخاب کنید.
                </p>
                <p>
                  ۳. در گوشه بالا دکمه <strong>Add</strong> را بزنید تا برنامه مثل یک اپلیکیشن واقعی نصب شود.
                </p>
              </div>
              <button
                onClick={() => setShowIOSGuide(false)}
                className="mt-5 w-full rounded-xl bg-amber-500 hover:bg-amber-600 py-2.5 text-xs font-bold text-white transition cursor-pointer"
              >
                متوجه شدم
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
