// Donéo — site de présentation : menu mobile, lightbox, onglets, Mermaid.

// Menu mobile
const burger = document.querySelector(".burger");
const menu = document.getElementById("menu");
burger.addEventListener("click", () => {
  const ouvert = menu.classList.toggle("ouvert");
  burger.setAttribute("aria-expanded", String(ouvert));
});
menu.addEventListener("click", (e) => {
  if (e.target.closest("a")) {
    menu.classList.remove("ouvert");
    burger.setAttribute("aria-expanded", "false");
  }
});

// Lightbox : <dialog> modal, fermé par Échap (natif), le bouton ou un clic à côté.
const lightbox = document.getElementById("lightbox");
const lightboxImg = lightbox.querySelector("img");
const lightboxLegende = lightbox.querySelector("p");
document.querySelectorAll(".zoom").forEach((bouton) => {
  bouton.addEventListener("click", () => {
    const img = bouton.querySelector("img");
    lightboxImg.src = bouton.dataset.grand || img.src;
    lightboxImg.alt = img.alt;
    lightboxLegende.textContent = img.alt;
    lightbox.showModal();
  });
});
lightbox.querySelector(".lightbox-fermer").addEventListener("click", () => lightbox.close());
lightbox.addEventListener("click", (e) => {
  if (e.target === lightbox) lightbox.close();
});

// Onglets des User Journey Maps (flèches gauche / droite)
const onglets = [...document.querySelectorAll('[role="tab"]')];
function activer(onglet) {
  onglets.forEach((o) => {
    const actif = o === onglet;
    o.setAttribute("aria-selected", String(actif));
    o.tabIndex = actif ? 0 : -1;
    document.getElementById(o.getAttribute("aria-controls")).hidden = !actif;
  });
  onglet.focus();
}
onglets.forEach((o, i) => {
  o.addEventListener("click", () => activer(o));
  o.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight") activer(onglets[(i + 1) % onglets.length]);
    if (e.key === "ArrowLeft") activer(onglets[(i - 1 + onglets.length) % onglets.length]);
  });
});

// Diagrammes Mermaid, aux couleurs de la charte
import("https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs").then(({ default: mermaid }) => {
  mermaid.initialize({
    startOnLoad: false,
    theme: "base",
    themeVariables: {
      fontFamily: "Inter, sans-serif",
      primaryColor: "#E7D6F5",
      primaryBorderColor: "#9B4DDB",
      primaryTextColor: "#2F4F5C",
      lineColor: "#9B4DDB",
      secondaryColor: "#C6CAF6",
      tertiaryColor: "#F7F2FC",
      noteBkgColor: "#EDF5B3",
      noteBorderColor: "#2F4F5C",
      actorBkg: "#E7D6F5",
      actorBorder: "#9B4DDB",
    },
  });
  mermaid.run({ querySelector: ".mermaid" });
});
