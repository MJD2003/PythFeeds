let originalHref: string | null = null;
let canvas: HTMLCanvasElement | null = null;

export function setFaviconBadge(color: "green" | "red" | null) {
  if (typeof document === "undefined") return;

  const link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (!link) return;

  if (!originalHref) originalHref = link.href;

  if (!color) {
    link.href = originalHref;
    return;
  }

  if (!canvas) canvas = document.createElement("canvas");
  canvas.width = 32;
  canvas.height = 32;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const img = new Image();
  img.crossOrigin = "anonymous";
  img.onload = () => {
    ctx.clearRect(0, 0, 32, 32);
    ctx.drawImage(img, 0, 0, 32, 32);
    ctx.beginPath();
    ctx.arc(26, 6, 5, 0, Math.PI * 2);
    ctx.fillStyle = color === "green" ? "#16c784" : "#ea3943";
    ctx.fill();
    ctx.strokeStyle = "#0d0d0f";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    link.href = canvas!.toDataURL("image/png");
  };
  img.src = originalHref;
}
