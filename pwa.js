if ("serviceWorker" in navigator) {
  window.addEventListener("load", async () => {
    try {
      const reg = await navigator.serviceWorker.register("./sw.js", { scope: "./" });

      // If a new SW is already waiting, activate it
      if (reg.waiting) {
        reg.waiting.postMessage({ type: "SKIP_WAITING" });
      }

      // When a new SW is found, wait for it to install, then activate it
      reg.addEventListener("updatefound", () => {
        const newWorker = reg.installing;
        if (!newWorker) return;

        newWorker.addEventListener("statechange", () => {
          if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
            // New version is ready; activate it
            newWorker.postMessage({ type: "SKIP_WAITING" });
          }
        });
      });

      // Reload once when the new SW takes control
      let reloaded = false;
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (reloaded) return;
        reloaded = true;
        window.location.reload();
      });

    } catch (e) {
      console.warn("Service worker registration failed:", e);
    }
  });
}
