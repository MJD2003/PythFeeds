"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";

const ServiceWorkerRegistration = dynamic(() => import("@/Components/shared/ServiceWorkerRegistration"), { ssr: false });
const GasTrackerBanner = dynamic(() => import("@/Components/shared/GasTracker").then(m => m.GasTrackerBanner), { ssr: false });
const KeyboardShortcuts = dynamic(() => import("@/Components/shared/KeyboardShortcuts"), { ssr: false });
const PythPrewarm = dynamic(() => import("@/Components/shared/PythPrewarm"), { ssr: false });
const PythTickerBar = dynamic(() => import("@/Components/shared/PythTickerBar"), { ssr: false });

export default function ClientShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <>
      <PythTickerBar />
      <AnimatePresence mode="wait">
        <motion.div
          key={pathname}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.2, ease: "easeInOut" }}
        >
          {children}
        </motion.div>
      </AnimatePresence>
      <GasTrackerBanner />
      <KeyboardShortcuts />
      <ServiceWorkerRegistration />
      <PythPrewarm />
    </>
  );
}
