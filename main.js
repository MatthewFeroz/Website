// Minimal GSAP animations for hero + scroll reveals + parallax
// Requires gsap and ScrollTrigger loaded in index.html

(function () {
  // Mobile nav toggle (runs regardless of GSAP availability)
  const navToggle = document.querySelector('.nav-toggle');
  const mobileMenu = document.getElementById('mobile-menu');
  if (navToggle && mobileMenu) {
    const setOpen = (open) => {
      navToggle.setAttribute('aria-expanded', String(open));
      if (open) {
        mobileMenu.removeAttribute('hidden');
        mobileMenu.setAttribute('aria-hidden', 'false');
        document.body.classList.add('menu-open');
      } else {
        mobileMenu.setAttribute('hidden', '');
        mobileMenu.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('menu-open');
      }
    };
    setOpen(false);
    navToggle.addEventListener('click', () => {
      const open = navToggle.getAttribute('aria-expanded') === 'true';
      setOpen(!open);
    });

    // Close on close button or when a menu link/cta is clicked
    const mobileCloseButton = mobileMenu.querySelector('.mobile-close');
    if (mobileCloseButton) {
      mobileCloseButton.addEventListener('click', () => setOpen(false));
    }
    mobileMenu.querySelectorAll('.mobile-link, .mobile-cta').forEach((el) => {
      el.addEventListener('click', () => setOpen(false));
    });
  }

  // Typeform lazy loading functionality
  const typeformPlaceholder = document.getElementById('typeform-placeholder');
  const typeformIframe = document.getElementById('typeform-iframe');
  const loadTypeformBtn = document.getElementById('load-typeform-btn');
  
  if (typeformPlaceholder && typeformIframe && loadTypeformBtn) {
    let typeformLoaded = false;
    
    const loadTypeform = () => {
      if (typeformLoaded) return;
      
      typeformLoaded = true;
      typeformIframe.src = 'https://form.typeform.com/to/T2ZPmUED';
      typeformIframe.style.display = 'block';
      typeformPlaceholder.style.display = 'none';
      
      // Smooth scroll to the form after loading
      setTimeout(() => {
        typeformIframe.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 500);
    };
    
    // Load on button click
    loadTypeformBtn.addEventListener('click', loadTypeform);
    
    // Load when user scrolls near the form (Intersection Observer)
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting && !typeformLoaded) {
          // Load the form when it comes into view
          loadTypeform();
        }
      });
    }, {
      threshold: 0.3, // Load when 30% of the placeholder is visible
      rootMargin: '50px' // Start loading 50px before it's fully visible
    });
    
    observer.observe(typeformPlaceholder);
    
    // Also load when any "BOOK A FREE CALL" button is clicked
    document.querySelectorAll('[data-tf-popup="T2ZPmUED"]').forEach(button => {
      button.addEventListener('click', (e) => {
        // If it's not a popup button, load the embedded form
        if (!button.hasAttribute('data-tf-popup') || button.getAttribute('data-tf-medium') !== 'site-cta') {
          e.preventDefault();
          loadTypeform();
        }
      });
    });
  }

  // GSAP-powered animations below — safe to skip if GSAP failed to load
  if (!window.gsap) return;
  const gsap = window.gsap;
  if (window.ScrollTrigger) gsap.registerPlugin(window.ScrollTrigger);

  // Entrance animation for hero
  gsap.set([".hero-image", ".hero-content h1", ".hero-content p", ".primary-button"], { opacity: 0, y: 24 });
  gsap.to(".hero-image", { opacity: 1, y: 0, duration: 0.8, ease: "power3.out", delay: 0.05 });
  gsap.to(".hero-content h1", { opacity: 1, y: 0, duration: 0.7, ease: "power3.out", delay: 0.15 });
  gsap.to(".hero-content p", { opacity: 1, y: 0, duration: 0.7, ease: "power3.out", delay: 0.28 });
  gsap.to(".primary-button", { opacity: 1, y: 0, duration: 0.6, ease: "power3.out", delay: 0.42 });
  
  // Ensure elements are visible on mobile (override any GSAP hiding)
  if (window.innerWidth <= 768) {
    gsap.set([".hero-content h1", ".hero-content p", ".audience-callout", ".audience-callout h2"], { 
      opacity: 1, 
      y: 0, 
      display: "block",
      visibility: "visible"
    });
  }

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

  // FAQ Toggle functionality (multiple can be open)
  const faqQuestions = document.querySelectorAll('.faq-question');
  faqQuestions.forEach(question => {
    question.addEventListener('click', () => {
      const faqItem = question.parentElement;
      const isActive = faqItem.classList.contains('active');
      
      // Toggle current FAQ item
      if (isActive) {
        faqItem.classList.remove('active');
        question.setAttribute('aria-expanded', 'false');
      } else {
        faqItem.classList.add('active');
        question.setAttribute('aria-expanded', 'true');
      }
    });
  });
})();

