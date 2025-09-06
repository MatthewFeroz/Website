// Minimal GSAP animations for hero + scroll reveals + parallax
// Requires gsap and ScrollTrigger loaded in index.html

(function () {
  if (!window.gsap) return;
  const gsap = window.gsap;
  if (window.ScrollTrigger) gsap.registerPlugin(window.ScrollTrigger);

  // Mobile nav toggle
  const navToggle = document.querySelector('.nav-toggle');
  const mobileMenu = document.getElementById('mobile-menu');
  if (navToggle && mobileMenu) {
    const setOpen = (open) => {
      navToggle.setAttribute('aria-expanded', String(open));
      if (open) {
        mobileMenu.removeAttribute('hidden');
        mobileMenu.setAttribute('aria-hidden', 'false');
      } else {
        mobileMenu.setAttribute('hidden', '');
        mobileMenu.setAttribute('aria-hidden', 'true');
      }
    };
    setOpen(false);
    navToggle.addEventListener('click', () => {
      const open = navToggle.getAttribute('aria-expanded') === 'true';
      setOpen(!open);
    });
  }

  // Entrance animation for hero
  gsap.set([".hero-image", ".hero-content h1", ".hero-content p", ".primary-button"], { opacity: 0, y: 24 });
  gsap.to(".hero-image", { opacity: 1, y: 0, duration: 0.8, ease: "power3.out", delay: 0.05 });
  gsap.to(".hero-content h1", { opacity: 1, y: 0, duration: 0.7, ease: "power3.out", delay: 0.15 });
  gsap.to(".hero-content p", { opacity: 1, y: 0, duration: 0.7, ease: "power3.out", delay: 0.28 });
  gsap.to(".primary-button", { opacity: 1, y: 0, duration: 0.6, ease: "power3.out", delay: 0.42 });

  // Logos stagger reveal
  const logos = document.querySelectorAll(".logos-grid .logo-item");
  if (logos.length) {
    gsap.set(logos, { opacity: 0, y: 16 });
    if (window.ScrollTrigger) {
      gsap.to(logos, {
        opacity: 1,
        y: 0,
        duration: 0.5,
        ease: "power2.out",
        stagger: 0.06,
        scrollTrigger: { trigger: ".logos", start: "top 80%" }
      });
    } else {
      gsap.to(logos, { opacity: 1, y: 0, duration: 0.5, ease: "power2.out", stagger: 0.06, delay: 0.3 });
    }
  }

  // About reveal
  const aboutEls = document.querySelectorAll('.about-content, .about-photo');
  if (aboutEls.length) {
    gsap.set(aboutEls, { opacity: 0, y: 20 });
    if (window.ScrollTrigger) {
      gsap.to(aboutEls, { opacity: 1, y: 0, duration: 0.6, ease: 'power2.out', stagger: 0.08, scrollTrigger: { trigger: '.about', start: 'top 80%' } });
    } else {
      gsap.to(aboutEls, { opacity: 1, y: 0, duration: 0.6, ease: 'power2.out', stagger: 0.08, delay: 0.3 });
    }
  }

  // Help cards reveal
  const helpCards = document.querySelectorAll('.help-card');
  if (helpCards.length) {
    gsap.set(helpCards, { opacity: 0, y: 18 });
    if (window.ScrollTrigger) {
      gsap.to(helpCards, { opacity: 1, y: 0, duration: 0.5, ease: 'power2.out', stagger: 0.08, scrollTrigger: { trigger: '.help', start: 'top 80%' } });
    } else {
      gsap.to(helpCards, { opacity: 1, y: 0, duration: 0.5, ease: 'power2.out', stagger: 0.08, delay: 0.3 });
    }
  }

  // Videos scroller reveal
  const videoCards = document.querySelectorAll(".videos-scroller .video-card");
  if (videoCards.length) {
    gsap.set(videoCards, { opacity: 0, y: 18 });
    if (window.ScrollTrigger) {
      gsap.to(videoCards, {
        opacity: 1,
        y: 0,
        duration: 0.5,
        ease: "power2.out",
        stagger: 0.08,
        scrollTrigger: { trigger: ".videos", start: "top 80%" }
      });
    } else {
      gsap.to(videoCards, { opacity: 1, y: 0, duration: 0.5, ease: "power2.out", stagger: 0.08, delay: 0.3 });
    }
  }

  // Scroll reveal for resource cards
  document.querySelectorAll('.resource-card').forEach((el) => {
    gsap.set(el, { opacity: 0, y: 24 });
    if (window.ScrollTrigger) {
      gsap.to(el, { opacity: 1, y: 0, duration: 0.6, ease: 'power2.out', scrollTrigger: { trigger: el, start: 'top 85%' } });
    } else {
      gsap.to(el, { opacity: 1, y: 0, duration: 0.6, ease: 'power2.out', delay: 0.2 });
    }
  });

  // Prev/Next buttons scroll
  const scroller = document.getElementById('videos-scroller');
  const prevBtn = document.getElementById('videos-prev');
  const nextBtn = document.getElementById('videos-next');
  if (scroller && prevBtn && nextBtn) {
    const scrollBy = () => Math.min(400, scroller.clientWidth * 0.8);
    prevBtn.addEventListener('click', () => scroller.scrollBy({ left: -scrollBy(), behavior: 'smooth' }));
    nextBtn.addEventListener('click', () => scroller.scrollBy({ left: scrollBy(), behavior: 'smooth' }));
  }

  // Parallax on hover removed per request — image stays static
})();
