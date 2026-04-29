// Minimal GSAP animations for hero + scroll reveals + parallax
// Requires gsap and ScrollTrigger loaded in index.html

(function () {
  // Mobile nav toggle (runs regardless of GSAP availability)
  const navToggle = document.querySelector('.nav-toggle');
  const mobileMenu = document.getElementById('mobile-menu');
  if (navToggle && mobileMenu) {
    // Drop the [hidden] attribute once JS is in control — visibility is now
    // driven by aria-hidden + CSS transitions instead of display:none.
    mobileMenu.removeAttribute('hidden');

    const isOpen = () => navToggle.getAttribute('aria-expanded') === 'true';

    const setOpen = (open) => {
      navToggle.setAttribute('aria-expanded', String(open));
      navToggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
      mobileMenu.setAttribute('aria-hidden', String(!open));
      document.body.classList.toggle('menu-open', open);
    };
    setOpen(false);

    navToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      setOpen(!isOpen());
    });

    // Close on close button (legacy support) or when any link/cta is clicked
    const mobileCloseButton = mobileMenu.querySelector('.mobile-close');
    if (mobileCloseButton) {
      mobileCloseButton.addEventListener('click', () => setOpen(false));
    }
    mobileMenu.querySelectorAll('.mobile-link, .mobile-cta').forEach((el) => {
      el.addEventListener('click', () => setOpen(false));
    });

    // Stop clicks inside the menu from bubbling up and triggering close-on-outside
    mobileMenu.addEventListener('click', (e) => e.stopPropagation());

    // Click anywhere outside the navbar/menu to close
    document.addEventListener('click', () => {
      if (isOpen()) setOpen(false);
    });

    // ESC closes and returns focus to the toggle
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && isOpen()) {
        setOpen(false);
        navToggle.focus();
      }
    });

    // If the viewport grows past the desktop breakpoint while open, reset state
    const desktopMq = window.matchMedia('(min-width: 900px)');
    const handleMqChange = (mq) => {
      if (mq.matches && isOpen()) setOpen(false);
    };
    if (desktopMq.addEventListener) {
      desktopMq.addEventListener('change', handleMqChange);
    } else if (desktopMq.addListener) {
      desktopMq.addListener(handleMqChange); // Safari < 14 fallback
    }
  }

  // Hide navbar on scroll down, show on scroll up — but never while the
  // mobile menu is open (the dropdown is anchored to the navbar, so hiding
  // the navbar would hide the menu out from under the user's tap).
  let lastScrollTop = 0;
  const navbar = document.querySelector('.navbar');
  const scrollThreshold = 50;

  window.addEventListener('scroll', () => {
    if (!navbar) return;
    if (document.body.classList.contains('menu-open')) {
      navbar.classList.remove('navbar-hidden');
      return;
    }

    const currentScroll = window.pageYOffset || document.documentElement.scrollTop;

    if (currentScroll > scrollThreshold) {
      if (currentScroll > lastScrollTop) {
        navbar.classList.add('navbar-hidden');
      } else {
        navbar.classList.remove('navbar-hidden');
      }
    } else {
      navbar.classList.remove('navbar-hidden');
    }

    lastScrollTop = currentScroll <= 0 ? 0 : currentScroll;
  });

  // Typeform lazy loading functionality
  const typeformPlaceholder = document.getElementById('typeform-placeholder');
  const typeformIframe = document.getElementById('typeform-iframe');
  const loadTypeformBtn = document.getElementById('load-typeform-btn');
  
  if (typeformPlaceholder && typeformIframe && loadTypeformBtn) {
    let typeformLoaded = false;
    
    const loadTypeform = () => {
      if (typeformLoaded) return;
      
      typeformLoaded = true;
      typeformIframe.src = 'https://form.typeform.com/to/T2ZPmUED?disable-auto-focus=true';
      typeformIframe.style.display = 'block';
      typeformPlaceholder.style.display = 'none';
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

  const heroShell = document.querySelector('.hero-shell');
  const heroShowcase = document.querySelector('.hero-showcase');
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const supportsFinePointer = window.matchMedia('(pointer: fine)').matches;

  if (heroShell && heroShowcase && !prefersReducedMotion && supportsFinePointer) {
    const setHeroPointer = (event) => {
      const rect = heroShell.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width) * 100;
      const y = ((event.clientY - rect.top) / rect.height) * 100;
      const tiltX = ((x - 50) / 50) * 4;
      const tiltY = ((y - 50) / 50) * 4;

      heroShell.style.setProperty('--hero-spotlight-x', `${x}%`);
      heroShell.style.setProperty('--hero-spotlight-y', `${y}%`);
      heroShowcase.style.setProperty('--hero-tilt-x', tiltX.toFixed(2));
      heroShowcase.style.setProperty('--hero-tilt-y', tiltY.toFixed(2));
    };

    const resetHeroPointer = () => {
      heroShell.style.setProperty('--hero-spotlight-x', '50%');
      heroShell.style.setProperty('--hero-spotlight-y', '50%');
      heroShowcase.style.setProperty('--hero-tilt-x', '0');
      heroShowcase.style.setProperty('--hero-tilt-y', '0');
    };

    heroShell.addEventListener('pointermove', setHeroPointer);
    heroShell.addEventListener('pointerleave', resetHeroPointer);
    resetHeroPointer();
  }

  // GSAP-powered animations below — safe to skip if GSAP failed to load
  const CONVEX_SITE_URL = "https://grateful-pony-674.convex.site";
  const YOUTUBE_ENDPOINTS = [
    `${window.location.origin}/youtube/videos`,
    `${CONVEX_SITE_URL}/youtube/videos`,
  ];
  const VIDEO_CACHE_KEY = "youtube_videos_cache";
  const VIDEO_CACHE_TTL = 30 * 60 * 1000;
  const FALLBACK_VIDEOS = [
    { title: "This programming language makes you rich?", videoId: "M3vM01-tIa0", link: "https://www.youtube.com/watch?v=M3vM01-tIa0", published: "" },
    { title: "This $500,000 Kickstarter Is Now DEAD...", videoId: "RqWaNgRw7Uk", link: "https://www.youtube.com/watch?v=RqWaNgRw7Uk", published: "" },
    { title: "How To Vibe Code The Ultimate Personal Project", videoId: "qABZxiUE9vM", link: "https://www.youtube.com/watch?v=qABZxiUE9vM", published: "" },
    { title: "How Tripping Out Saved Software Engineering", videoId: "tnbcc17jCiw", link: "https://www.youtube.com/watch?v=tnbcc17jCiw", published: "" },
    { title: "Why Michael Reeves Is A Better Engineer Than You", videoId: "uL8r0ERxd1c", link: "https://www.youtube.com/watch?v=uL8r0ERxd1c", published: "" },
    { title: "How William Osman Changed Engineering Forever", videoId: "PtDzwTykJKQ", link: "https://www.youtube.com/watch?v=PtDzwTykJKQ", published: "" },
    { title: "Watch This BEFORE You Start Engineering!", videoId: "YVRgAmFW0x8", link: "https://www.youtube.com/watch?v=YVRgAmFW0x8", published: "" },
  ];

  const getCachedVideos = () => {
    try {
      const raw = localStorage.getItem(VIDEO_CACHE_KEY);
      if (!raw) return null;
      const cached = JSON.parse(raw);
      if (Date.now() - cached.timestamp < VIDEO_CACHE_TTL && Array.isArray(cached.videos) && cached.videos.length) {
        return cached.videos;
      }
    } catch (e) {
      // Ignore broken cache data.
    }
    return null;
  };

  const saveCachedVideos = (videos) => {
    try {
      localStorage.setItem(VIDEO_CACHE_KEY, JSON.stringify({ videos, timestamp: Date.now() }));
    } catch (e) {
      // Storage can be disabled or full.
    }
  };

  const getVideoId = (video) => {
    if (video.videoId) return video.videoId;
    const match = String(video.link || "").match(/[?&]v=([^&]+)/);
    return match ? match[1] : "";
  };

  const formatPublishedDate = (published) => {
    if (!published) return "Featured video";
    const date = new Date(published);
    if (Number.isNaN(date.getTime())) return published;
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  };

  const formatVideoMeta = (video) => {
    const parts = [formatPublishedDate(video.published)];
    if (video.views) parts.unshift(video.views);
    return parts.filter(Boolean).join(" • ");
  };

  const createVideoCard = (video) => {
    const videoId = getVideoId(video);
    const title = video.title || "Watch on YouTube";
    const link = video.link || `https://www.youtube.com/watch?v=${videoId}`;
    const thumbnail = video.thumbnail || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
    const card = document.createElement("article");
    card.className = "video-card";

    const thumb = document.createElement("a");
    thumb.className = "video-thumb";
    thumb.href = link;
    thumb.target = "_blank";
    thumb.rel = "noopener";
    thumb.setAttribute("aria-label", `Play: ${title}`);
    thumb.style.backgroundImage = `url("${thumbnail}")`;

    const heading = document.createElement("h4");
    heading.className = "video-title";
    heading.textContent = title;

    const meta = document.createElement("p");
    meta.className = "video-meta";
    meta.textContent = formatVideoMeta(video);

    card.append(thumb, heading, meta);
    return card;
  };

  const animateVideoCards = (cards) => {
    if (!cards.length || !window.gsap) return;
    window.gsap.set(cards, { opacity: 0, y: 18 });
    window.gsap.to(cards, {
      opacity: 1,
      y: 0,
      duration: 0.5,
      ease: "power2.out",
      stagger: 0.08,
      delay: 0.05,
    });
  };

  const setupVideoControls = () => {
    const scroller = document.getElementById('videos-scroller');
    const prevBtn = document.getElementById('videos-prev');
    const nextBtn = document.getElementById('videos-next');
    if (!scroller || !prevBtn || !nextBtn || scroller.dataset.controlsReady === "true") return;
    scroller.dataset.controlsReady = "true";

    const scrollByAmount = () => {
      const firstCard = scroller.querySelector(".video-card");
      if (!firstCard) return scroller.clientWidth;
      const styles = window.getComputedStyle(scroller);
      const gap = Number.parseFloat(styles.columnGap || styles.gap || "0") || 0;
      return firstCard.getBoundingClientRect().width + gap;
    };
    const updateButtons = () => {
      const maxScroll = scroller.scrollWidth - scroller.clientWidth - 2;
      prevBtn.disabled = scroller.scrollLeft <= 2;
      nextBtn.disabled = scroller.scrollLeft >= maxScroll;
    };

    prevBtn.addEventListener('click', () => scroller.scrollBy({ left: -scrollByAmount(), behavior: 'smooth' }));
    nextBtn.addEventListener('click', () => scroller.scrollBy({ left: scrollByAmount(), behavior: 'smooth' }));
    scroller.addEventListener('scroll', updateButtons, { passive: true });
    window.addEventListener('resize', updateButtons);
    requestAnimationFrame(updateButtons);
  };

  const renderVideos = (videos, statusText) => {
    const scroller = document.getElementById("videos-scroller");
    const status = document.getElementById("videos-status");
    if (!scroller) return;

    scroller.classList.remove("is-loading");
    scroller.innerHTML = "";
    videos.forEach((video) => scroller.appendChild(createVideoCard(video)));
    if (status) status.textContent = statusText || "";

    const cards = Array.from(scroller.querySelectorAll(".video-card"));
    animateVideoCards(cards);
    requestAnimationFrame(() => {
      const nextBtn = document.getElementById('videos-next');
      if (nextBtn) nextBtn.disabled = scroller.scrollWidth <= scroller.clientWidth + 2;
    });
  };

  const fetchYouTubeVideos = async () => {
    let lastError = null;
    for (const endpoint of YOUTUBE_ENDPOINTS) {
      try {
        const response = await fetch(endpoint);
        if (!response.ok) throw new Error(`YouTube feed failed with ${response.status}`);
        const data = await response.json();
        if (Array.isArray(data.videos) && data.videos.length) return data.videos;
      } catch (error) {
        lastError = error;
      }
    }
    console.error("YouTube videos fetch error:", lastError);
    return null;
  };

  const hydrateYouTubeVideos = async () => {
    const scroller = document.getElementById("videos-scroller");
    if (!scroller) return;

    const cachedVideos = getCachedVideos();
    if (cachedVideos) renderVideos(cachedVideos, "Updated from YouTube recently.");

    const freshVideos = await fetchYouTubeVideos();
    if (freshVideos) {
      saveCachedVideos(freshVideos);
      renderVideos(freshVideos, "Latest uploads from Matt's YouTube channel.");
      return;
    }

    if (!cachedVideos) {
      renderVideos(FALLBACK_VIDEOS, "Showing featured videos while YouTube is unavailable.");
    }
  };

  hydrateYouTubeVideos();
  setupVideoControls();

  if (!window.gsap) return;
  const gsap = window.gsap;
  if (window.ScrollTrigger) gsap.registerPlugin(window.ScrollTrigger);

  // Entrance animation for hero
  gsap.set([".hero-kicker", ".hero-title", ".hero-description", ".hero-proof-pill", ".hero-actions .primary-button", ".hero-actions .secondary-button", ".hero-stat-card", ".hero-showcase", ".hero-path-card"], { opacity: 0, y: 24 });
  gsap.to(".hero-kicker", { opacity: 1, y: 0, duration: 0.55, ease: "power3.out", delay: 0.08 });
  gsap.to(".hero-title", { opacity: 1, y: 0, duration: 0.72, ease: "power3.out", delay: 0.16 });
  gsap.to(".hero-description", { opacity: 1, y: 0, duration: 0.65, ease: "power3.out", delay: 0.26 });
  gsap.to(".hero-proof-pill", { opacity: 1, y: 0, duration: 0.48, ease: "power2.out", stagger: 0.08, delay: 0.34 });
  gsap.to([".hero-actions .primary-button", ".hero-actions .secondary-button"], { opacity: 1, y: 0, duration: 0.55, ease: "power3.out", stagger: 0.08, delay: 0.42 });
  gsap.to(".hero-stat-card", { opacity: 1, y: 0, duration: 0.55, ease: "power3.out", stagger: 0.1, delay: 0.5 });
  gsap.to(".hero-showcase", { opacity: 1, y: 0, duration: 0.8, ease: "power3.out", delay: 0.18 });
  gsap.to(".hero-path-card", { opacity: 1, y: 0, duration: 0.55, ease: "power3.out", stagger: 0.08, delay: 0.54 });
  
  // Ensure elements are visible on mobile (override any GSAP hiding)
  if (window.innerWidth <= 768) {
    gsap.set([".hero-kicker", ".hero-title", ".hero-description", ".hero-proof-pill", ".hero-actions .primary-button", ".hero-actions .secondary-button", ".hero-stat-card", ".hero-showcase", ".hero-path-card"], { 
      opacity: 1, 
      y: 0
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

  // Scroll reveal for resource cards
  document.querySelectorAll('.resource-card').forEach((el) => {
    gsap.set(el, { opacity: 0, y: 24 });
    if (window.ScrollTrigger) {
      gsap.to(el, { opacity: 1, y: 0, duration: 0.6, ease: 'power2.out', scrollTrigger: { trigger: el, start: 'top 85%' } });
    } else {
      gsap.to(el, { opacity: 1, y: 0, duration: 0.6, ease: 'power2.out', delay: 0.2 });
    }
  });
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

