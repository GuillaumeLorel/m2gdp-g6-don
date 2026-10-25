// Donéo — script principal (vanilla, sans dépendance)

/* ==========================================================================
   Menu mobile
   ========================================================================== */
function initMenuMobile() {
  const bouton = document.querySelector('.bouton-burger');
  const menu = document.querySelector('.menu-mobile');
  const superposition = document.querySelector('.superposition');
  const fermerBouton = document.querySelector('.menu-mobile__fermer');
  if (!bouton || !menu || !superposition) return;

  let dernierElementFocus = null;

  function elementsFocusables() {
    return Array.from(
      menu.querySelectorAll('a, button, input, select, textarea, [tabindex]')
    ).filter((el) => !el.hasAttribute('disabled'));
  }

  function ouvrirMenu() {
    dernierElementFocus = document.activeElement;
    menu.classList.add('est-ouvert');
    superposition.classList.add('est-visible');
    bouton.setAttribute('aria-expanded', 'true');
    menu.removeAttribute('hidden');
    document.body.style.overflow = 'hidden';
    const focusables = elementsFocusables();
    if (focusables.length) focusables[0].focus();
  }

  function fermerMenu() {
    menu.classList.remove('est-ouvert');
    superposition.classList.remove('est-visible');
    bouton.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
    if (dernierElementFocus) dernierElementFocus.focus();
  }

  bouton.addEventListener('click', () => {
    const estOuvert = bouton.getAttribute('aria-expanded') === 'true';
    estOuvert ? fermerMenu() : ouvrirMenu();
  });

  fermerBouton?.addEventListener('click', fermerMenu);
  superposition.addEventListener('click', fermerMenu);

  menu.querySelectorAll('.menu-mobile__lien').forEach((lien) => {
    lien.addEventListener('click', fermerMenu);
  });

  document.addEventListener('keydown', (evenement) => {
    if (!menu.classList.contains('est-ouvert')) return;

    if (evenement.key === 'Escape') {
      fermerMenu();
      return;
    }

    if (evenement.key === 'Tab') {
      const focusables = elementsFocusables();
      if (!focusables.length) return;
      const premier = focusables[0];
      const dernier = focusables[focusables.length - 1];

      if (evenement.shiftKey && document.activeElement === premier) {
        evenement.preventDefault();
        dernier.focus();
      } else if (!evenement.shiftKey && document.activeElement === dernier) {
        evenement.preventDefault();
        premier.focus();
      }
    }
  });
}

/* ==========================================================================
   Onglets « Comment ça marche »
   ========================================================================== */
function initOnglets() {
  const listes = document.querySelectorAll('[role="tablist"]');

  listes.forEach((liste) => {
    const onglets = Array.from(liste.querySelectorAll('[role="tab"]'));

    function activerOnglet(onglet, { focus = false } = {}) {
      onglets.forEach((o) => {
        const estActif = o === onglet;
        o.setAttribute('aria-selected', estActif ? 'true' : 'false');
        o.tabIndex = estActif ? 0 : -1;
        const panneauId = o.getAttribute('aria-controls');
        const panneau = document.getElementById(panneauId);
        if (panneau) panneau.hidden = !estActif;
        // Capture du téléphone associée au panneau (fondu géré en CSS)
        document.querySelectorAll(`img[data-panneau="${panneauId}"]`).forEach((ecran) => {
          ecran.classList.toggle('est-actif', estActif);
        });
      });
      if (focus) onglet.focus();
    }

    onglets.forEach((onglet, index) => {
      onglet.addEventListener('click', () => activerOnglet(onglet));

      onglet.addEventListener('keydown', (evenement) => {
        let nouvelIndex = null;
        if (evenement.key === 'ArrowRight' || evenement.key === 'ArrowDown') {
          nouvelIndex = (index + 1) % onglets.length;
        } else if (evenement.key === 'ArrowLeft' || evenement.key === 'ArrowUp') {
          nouvelIndex = (index - 1 + onglets.length) % onglets.length;
        } else if (evenement.key === 'Home') {
          nouvelIndex = 0;
        } else if (evenement.key === 'End') {
          nouvelIndex = onglets.length - 1;
        }
        if (nouvelIndex !== null) {
          evenement.preventDefault();
          activerOnglet(onglets[nouvelIndex], { focus: true });
        }
      });
    });
  });
}

/* ==========================================================================
   Accordéon FAQ
   ========================================================================== */
function initAccordeonFaq() {
  const questions = document.querySelectorAll('.faq-item__question');

  questions.forEach((question) => {
    question.addEventListener('click', () => {
      const estOuvert = question.getAttribute('aria-expanded') === 'true';
      const panneauId = question.getAttribute('aria-controls');
      const groupe = question.closest('.faq__groupe');

      if (groupe) {
        groupe.querySelectorAll('.faq-item__question').forEach((autre) => {
          if (autre !== question) {
            autre.setAttribute('aria-expanded', 'false');
            const autrePanneau = document.getElementById(autre.getAttribute('aria-controls'));
            if (autrePanneau) autrePanneau.hidden = true;
          }
        });
      }

      question.setAttribute('aria-expanded', estOuvert ? 'false' : 'true');
      const panneau = document.getElementById(panneauId);
      if (panneau) panneau.hidden = estOuvert;
    });
  });
}

/* ==========================================================================
   Validation du formulaire de contact
   ========================================================================== */
function initFormulaireContact() {
  const formulaire = document.getElementById('formulaire-contact');
  if (!formulaire) return;

  const statut = document.getElementById('formulaire-statut');

  const regles = {
    nom: (valeur) => valeur.trim().length >= 2,
    email: (valeur) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valeur.trim()),
    profil: (valeur) => valeur.trim().length > 0,
    message: (valeur) => valeur.trim().length >= 10,
    consentement: (valeur, champ) => champ.checked,
  };

  const messagesErreur = {
    nom: 'Merci d\'indiquer votre nom et prénom (2 caractères minimum).',
    email: 'Merci de saisir une adresse e-mail valide.',
    profil: 'Merci de préciser votre profil.',
    message: 'Votre message doit contenir au moins 10 caractères.',
    consentement: 'Merci d\'accepter l\'utilisation de vos données pour traiter votre demande.',
  };

  function validerChamp(champ) {
    const nom = champ.name;
    const regle = regles[nom];
    if (!regle) return true;

    const valeur = champ.type === 'checkbox' ? champ.checked : champ.value;
    const estValide = champ.type === 'checkbox' ? regle(valeur, champ) : regle(valeur, champ);
    const erreurId = `erreur-${nom}`;
    const elementErreur = document.getElementById(erreurId);

    if (!estValide) {
      champ.setAttribute('aria-invalid', 'true');
      if (elementErreur) elementErreur.textContent = messagesErreur[nom];
      return false;
    }

    champ.setAttribute('aria-invalid', 'false');
    if (elementErreur) elementErreur.textContent = '';
    return true;
  }

  Array.from(formulaire.elements).forEach((champ) => {
    if (regles[champ.name]) {
      const evenement = champ.type === 'checkbox' || champ.tagName === 'SELECT' ? 'change' : 'blur';
      champ.addEventListener(evenement, () => validerChamp(champ));
    }
  });

  formulaire.addEventListener('submit', (evenement) => {
    evenement.preventDefault();

    let premierChampInvalide = null;
    let formulaireValide = true;

    Array.from(formulaire.elements).forEach((champ) => {
      if (regles[champ.name]) {
        const estValide = validerChamp(champ);
        if (!estValide) {
          formulaireValide = false;
          if (!premierChampInvalide) premierChampInvalide = champ;
        }
      }
    });

    if (!formulaireValide) {
      if (statut) {
        statut.textContent = 'Merci de corriger les champs signalés ci-dessous.';
        statut.className = 'formulaire__statut formulaire__statut--erreur';
      }
      premierChampInvalide?.focus();
      return;
    }

    // Formulaire de démonstration : aucune donnée n'est envoyée.
    formulaire.reset();
    if (statut) {
      const lienEmail = document.createElement('a');
      lienEmail.href = 'mailto:hello@doneo.fr';
      lienEmail.textContent = 'hello@doneo.fr';
      statut.replaceChildren(
        'Merci ! Ce formulaire est une démonstration : aucun message n\'est envoyé. Pour nous écrire : ',
        lienEmail,
      );
      statut.className = 'formulaire__statut formulaire__statut--succes';
    }
  });
}

/* ==========================================================================
   Animations d'apparition au défilement
   ========================================================================== */
function initAnimationsDefilement() {
  const elements = document.querySelectorAll('.au-defilement');
  if (!elements.length) return;

  if (!('IntersectionObserver' in window) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    elements.forEach((el) => el.classList.add('est-visible'));
    return;
  }

  const observateur = new IntersectionObserver(
    (entrees) => {
      entrees.forEach((entree) => {
        if (entree.isIntersecting) {
          entree.target.classList.add('est-visible');
          observateur.unobserve(entree.target);
        }
      });
    },
    { threshold: 0.15, rootMargin: '0px 0px -40px 0px' }
  );

  elements.forEach((el) => observateur.observe(el));
}

/* ==========================================================================
   Défilement doux sur les ancres
   ========================================================================== */
function initDefilementDoux() {
  document.querySelectorAll('a[href^="#"]').forEach((lien) => {
    lien.addEventListener('click', (evenement) => {
      const cible = lien.getAttribute('href');
      if (!cible || cible === '#') return;
      const element = document.querySelector(cible);
      if (!element) return;

      evenement.preventDefault();
      element.scrollIntoView({
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
        block: 'start',
      });
      element.setAttribute('tabindex', '-1');
      element.focus({ preventScroll: true });
    });
  });
}

/* ==========================================================================
   Mise en surbrillance du lien de navigation actif
   ========================================================================== */
function initNavigationActive() {
  const liens = document.querySelectorAll('.entete__lien');
  if (!liens.length) return;

  const sections = Array.from(liens)
    .map((lien) => {
      const cible = lien.getAttribute('href');
      if (!cible || !cible.startsWith('#')) return null;
      const section = document.querySelector(cible);
      return section ? { lien, section } : null;
    })
    .filter(Boolean);

  if (!sections.length || !('IntersectionObserver' in window)) return;

  const observateur = new IntersectionObserver(
    (entrees) => {
      entrees.forEach((entree) => {
        const correspondance = sections.find((s) => s.section === entree.target);
        if (!correspondance) return;
        if (entree.isIntersecting) {
          liens.forEach((l) => l.classList.remove('est-actif'));
          correspondance.lien.classList.add('est-actif');
        }
      });
    },
    { rootMargin: '-40% 0px -50% 0px' }
  );

  sections.forEach(({ section }) => observateur.observe(section));
}

/* ==========================================================================
   Copie du lien de l'app (CTA final)
   ========================================================================== */
function copierTexte(texte) {
  if (navigator.clipboard && window.isSecureContext) {
    return navigator.clipboard.writeText(texte);
  }

  // Repli hors contexte sécurisé (page ouverte en file:// ou en HTTP)
  return new Promise((resoudre, rejeter) => {
    const precedent = document.activeElement;
    const zone = document.createElement('textarea');
    zone.value = texte;
    zone.setAttribute('readonly', '');
    zone.style.position = 'fixed';
    zone.style.opacity = '0';
    document.body.append(zone);
    zone.select();
    const reussi = document.execCommand('copy');
    zone.remove();
    precedent?.focus();
    reussi ? resoudre() : rejeter(new Error('Copie refusée'));
  });
}

function initCopieLien() {
  document.querySelectorAll('[data-copier]').forEach((bouton) => {
    const statut = document.getElementById(bouton.dataset.statut);
    if (!statut) return;
    let minuteur = null;

    bouton.addEventListener('click', async () => {
      let message = 'Lien copié !';
      let duree = 2000;
      try {
        await copierTexte(bouton.dataset.copier);
      } catch {
        message = 'Copie impossible : l\'adresse est doneo.web.app';
        duree = 5000;
      }

      // Vider puis remplir pour que la zone role="status" soit relue à chaque clic
      clearTimeout(minuteur);
      statut.textContent = '';
      requestAnimationFrame(() => {
        statut.textContent = message;
      });
      minuteur = setTimeout(() => {
        statut.textContent = '';
      }, duree);
    });
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initMenuMobile();
  initOnglets();
  initAccordeonFaq();
  initFormulaireContact();
  initAnimationsDefilement();
  initDefilementDoux();
  initNavigationActive();
  initCopieLien();
});
