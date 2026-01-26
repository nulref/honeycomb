if ("serviceWorker" in navigator) {
  window.addEventListener("load", async () => {
    try {
      await navigator.serviceWorker.register("./sw.js", { scope: "./" });
      // Optional: console.log("Service worker registered");
    } catch (e) {
      console.warn("Service worker registration failed:", e);
    }
  });
}