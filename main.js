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
      if (!open) {
        mobileMenu.querySelectorAll('.mobile-dropdown-trigger').forEach((trigger) => {
          trigger.setAttribute('aria-expanded', 'false');
          const menu = trigger.parentElement && trigger.parentElement.querySelector('.mobile-dropdown-menu');
          if (menu) menu.hidden = true;
        });
      }
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
    mobileMenu.querySelectorAll('.mobile-link:not(.mobile-dropdown-trigger), .mobile-cta').forEach((el) => {
      el.addEventListener('click', () => setOpen(false));
    });

    mobileMenu.querySelectorAll('.mobile-dropdown-trigger').forEach((trigger) => {
      const menu = trigger.parentElement && trigger.parentElement.querySelector('.mobile-dropdown-menu');
      trigger.addEventListener('click', (e) => {
        e.stopPropagation();
        const expanded = trigger.getAttribute('aria-expanded') === 'true';
        trigger.setAttribute('aria-expanded', String(!expanded));
        if (menu) menu.hidden = expanded;
      });
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

  // Desktop nav dropdowns — click to toggle, click outside or Escape to close
  document.querySelectorAll('.nav-dropdown').forEach((dropdown) => {
    const trigger = dropdown.querySelector('.nav-dropdown-trigger');
    if (!trigger) return;

    const close = () => {
      dropdown.classList.remove('is-open');
      trigger.setAttribute('aria-expanded', 'false');
    };

    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      const open = !dropdown.classList.contains('is-open');
      dropdown.classList.toggle('is-open', open);
      trigger.setAttribute('aria-expanded', String(open));
    });

    document.addEventListener('click', (e) => {
      if (dropdown.classList.contains('is-open') && !dropdown.contains(e.target)) {
        close();
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && dropdown.classList.contains('is-open')) {
        close();
        trigger.focus();
      }
    });
  });

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

  // GSAP-powered animations below — safe to skip if GSAP failed to load
  const CONVEX_SITE_URL = window.CONVEX_SITE_URL || "https://lovable-tapir-496.convex.site";
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
