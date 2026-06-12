const io = new IntersectionObserver(
  entries => entries.forEach(entry => {
    if (entry.isIntersecting) entry.target.classList.add('visible');
  }),
  { threshold: 0.12 }
);

document.querySelectorAll('.fade-in').forEach(element => io.observe(element));


const EDITORIAL_IMAGE_BASES = ['/assets/img', 'assets/img', '/assets', 'assets', '/img', 'img'];
const EDITORIAL_MANIFEST_URL = '/assets/img/editorial-images.json';
const EDITORIAL_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp'];
const EDITORIAL_DISCOVERY_NAMES = [
  'gerbera-red-cutout.png',
  'gerbera-pink-focus.jpg',
  'gerbera-bouquet-soft.jpg',
  'pexels-enginakyurt-15119486.jpg',
  'gerbera-petal-close.jpg',
  'pexels-soc-nang-d-ng-2150345854-34946345.jpg',
  'gerbera-final-bouquet.jpg',
  ...Array.from({ length: 8 }, (_, index) => `foto-${String(index + 1).padStart(2, '0')}.jpg`),
  ...Array.from({ length: 8 }, (_, index) => `photo-${String(index + 1).padStart(2, '0')}.jpg`),
  ...Array.from({ length: 8 }, (_, index) => `imagem-${String(index + 1).padStart(2, '0')}.jpg`)
];

const unique = items => [...new Set(items.filter(Boolean))];
const getFilename = path => decodeURIComponent((path || '').split('?')[0].split('#')[0].split('/').filter(Boolean).pop() || '');
const getFilenameStem = filename => filename.replace(/\.(png|jpe?g|webp)$/i, '');

const getFilenameVariants = filename => {
  if (!filename) return [];
  const extensionMatch = filename.match(/^(.*)\.(png|jpe?g|webp)$/i);

  if (!extensionMatch) return [filename];

  return unique([filename, ...EDITORIAL_EXTENSIONS.map(extension => `${extensionMatch[1]}.${extension}`)]);
};

const getEditorialImageFallbacks = image => {
  const source = image.getAttribute('src') || '';
  const fallback = image.dataset.fallbackSrc || '';
  const explicitCandidates = (image.dataset.candidates || '')
    .split(',')
    .map(candidate => candidate.trim())
    .filter(Boolean);
  const paths = [source, fallback, ...explicitCandidates].filter(Boolean);
  const filenames = unique(paths.map(getFilename).flatMap(getFilenameVariants));

  filenames.forEach(filename => {
    EDITORIAL_IMAGE_BASES.forEach(base => paths.push(`${base}/${filename}`));
  });

  return unique(paths);
};

const hideMissingEditorialImage = image => {
  const editorialPhoto = image.closest('.editorial-photo');

  if (editorialPhoto) {
    editorialPhoto.classList.add('is-missing');
  } else {
    image.hidden = true;
  }
};

const testImageSource = source => new Promise(resolve => {
  const probe = new Image();
  const timeout = window.setTimeout(() => resolve(null), 4500);

  probe.onload = () => {
    window.clearTimeout(timeout);
    resolve(source);
  };

  probe.onerror = () => {
    window.clearTimeout(timeout);
    resolve(null);
  };

  probe.src = source;
});

const loadEditorialManifest = async () => {
  try {
    const response = await fetch(`${EDITORIAL_MANIFEST_URL}?v=20260617`, { cache: 'no-store' });
    if (!response.ok) return [];

    const manifest = await response.json();
    const images = Array.isArray(manifest) ? manifest : manifest.images;

    return Array.isArray(images)
      ? images.map(image => (typeof image === 'string' ? image : image?.src)).filter(Boolean)
      : [];
  } catch {
    return [];
  }
};

const resolveAvailableEditorialImages = async manifestImages => {
  const currentImageSources = [...document.querySelectorAll('[data-editorial-image]')]
    .map(image => image.getAttribute('src'));
  const priorityNames = unique([
    ...manifestImages,
    ...currentImageSources.map(getFilename)
  ]);
  const priorityCandidates = priorityNames.flatMap(name => {
    const filename = getFilename(name);
    const variants = getFilenameVariants(filename || name);
    return variants.flatMap(variant => EDITORIAL_IMAGE_BASES.map(base => `${base}/${variant}`));
  });
  const discoveryCandidates = EDITORIAL_DISCOVERY_NAMES.flatMap(name => {
    const filename = getFilename(name);
    return getFilenameVariants(filename || name).map(variant => `/assets/img/${variant}`);
  });
  const sourceCandidates = unique([...priorityCandidates, ...discoveryCandidates]);
  const probes = await Promise.all(sourceCandidates.map(testImageSource));

  return unique(probes.filter(Boolean));
};

const buildEditorialGallery = (availableImages, manifestImages) => {
  const gallery = document.querySelector('[data-editorial-gallery]');
  if (!gallery) return;

  const fixedFilenames = new Set(
    [...document.querySelectorAll('[data-editorial-image]')]
      .map(image => getFilename(image.getAttribute('src')))
      .filter(Boolean)
  );
  const manifestFilenames = manifestImages.map(getFilename).filter(Boolean);
  const discoveryFilenames = EDITORIAL_DISCOVERY_NAMES.map(getFilename).filter(Boolean);
  const galleryImages = availableImages
    .filter(source => {
      const filename = getFilename(source);
      const isKnownExtra = manifestFilenames.includes(filename) || discoveryFilenames.includes(filename);
      return filename && !fixedFilenames.has(filename) && (!manifestFilenames.length || isKnownExtra);
    })
    .slice(0, 6);

  if (!galleryImages.length) {
    gallery.hidden = true;
    return;
  }

  gallery.innerHTML = galleryImages.map((source, index) => `
    <span class="editorial-gallery-item editorial-gallery-item-${index + 1}">
      <img src="${source}" alt="" loading="lazy" decoding="async">
    </span>
  `).join('');
};

const initializeEditorialImages = async () => {
  const editorialImages = [...document.querySelectorAll('[data-editorial-image]')];
  const manifestImages = await loadEditorialManifest();
  const availableImages = await resolveAvailableEditorialImages(manifestImages);
  const usedFallbacks = new Set(editorialImages.map(image => image.getAttribute('src')).filter(Boolean));

  editorialImages.forEach(image => {
    const fallbackPaths = unique([
      ...getEditorialImageFallbacks(image),
      ...availableImages.filter(source => {
        const sourceStem = getFilenameStem(getFilename(source));
        const imageStem = getFilenameStem(getFilename(image.getAttribute('src')));
        return sourceStem && imageStem && sourceStem === imageStem;
      }),
      ...availableImages.filter(source => !usedFallbacks.has(source))
    ]);
    let fallbackIndex = Math.max(0, fallbackPaths.indexOf(image.getAttribute('src')));

    const tryNextImageSource = () => {
      fallbackIndex += 1;

      if (fallbackIndex < fallbackPaths.length) {
        image.src = fallbackPaths[fallbackIndex];
        usedFallbacks.add(image.src);
        return;
      }

      hideMissingEditorialImage(image);
    };

    image.addEventListener('error', tryNextImageSource);

    if (image.complete && image.currentSrc && image.naturalWidth === 0) {
      tryNextImageSource();
    }
  });

  buildEditorialGallery(availableImages, manifestImages);
};

initializeEditorialImages();

(() => {
  const body = document.body;
  const intro = document.getElementById('video-intro');
  const iframe = document.getElementById('intro-vimeo');
  const startButton = document.getElementById('intro-start');
  const embed = intro?.querySelector('.intro-embed');
  const toggleButton = document.getElementById('intro-toggle');
  const progressButton = document.getElementById('intro-progress');
  const progressFill = document.getElementById('intro-progress-fill');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (!intro || !iframe || !startButton || !embed || !toggleButton || !progressButton || !progressFill) {
    body.classList.remove('intro-active');
    body.classList.add('site-ready');
    return;
  }

  let introFinished = false;
  let introStarted = false;
  let loadFallback;
  let stallFallback;
  let safetyFallback;
  let controlsFallback;
  let player;
  let videoDuration = 0;

  const clearTimers = () => {
    window.clearTimeout(loadFallback);
    window.clearTimeout(stallFallback);
    window.clearTimeout(safetyFallback);
    window.clearTimeout(controlsFallback);
  };

  const revealSite = () => {
    if (introFinished) return;
    introFinished = true;
    clearTimers();

    if (player) {
      player.pause().catch(() => {});
      player.unload().catch(() => {});
    }

    intro.classList.add('is-leaving');
    body.classList.remove('intro-active');
    body.classList.add('site-ready');

    window.setTimeout(() => {
      intro.remove();
    }, reduceMotion ? 80 : 1600);
  };

  const updateProgress = percent => {
    const safePercent = Math.max(0, Math.min(1, Number.isFinite(percent) ? percent : 0));
    const progressValue = Math.round(safePercent * 100);

    progressFill.style.transform = `scaleX(${safePercent})`;
    progressButton.setAttribute('aria-valuenow', String(progressValue));
    progressButton.setAttribute('aria-valuetext', `${progressValue}% do vídeo`);
  };


  const hideTransientControls = () => {
    if (!intro.classList.contains('is-paused')) {
      intro.classList.remove('is-controls-active');
    }
  };

  const showTransientControls = () => {
    if (!introStarted || introFinished) return;

    intro.classList.add('is-controls-active');
    window.clearTimeout(controlsFallback);
    controlsFallback = window.setTimeout(hideTransientControls, 1400);
  };

  const setPausedState = isPaused => {
    intro.classList.toggle('is-paused', isPaused);
    toggleButton.setAttribute('aria-label', isPaused ? 'Reproduzir vídeo' : 'Pausar vídeo');

    if (isPaused) {
      intro.classList.add('is-controls-active');
      window.clearTimeout(controlsFallback);
    } else {
      hideTransientControls();
    }
  };

  const startIntro = () => {
    if (introStarted) return;
    introStarted = true;
    intro.classList.add('is-started');
    setPausedState(false);
    startButton.disabled = true;

    if (!player) {
      safetyFallback = window.setTimeout(revealSite, 12000);
      return;
    }

    loadFallback = window.setTimeout(revealSite, 15000);
    safetyFallback = window.setTimeout(
      revealSite,
      videoDuration ? (videoDuration + 20) * 1000 : 600000
    );

    const soundRequests = [player.setVolume(1).catch(() => {})];

    if (typeof player.setMuted === 'function') {
      soundRequests.push(player.setMuted(false).catch(() => {}));
    }

    const playRequest = player.play();

    playRequest
      .then(() => Promise.allSettled(soundRequests))
      .then(() => {
        player.setVolume(1).catch(() => {});
        if (typeof player.setMuted === 'function') {
          player.setMuted(false).catch(() => {});
        }
      })
      .catch(() => {
        introStarted = false;
        intro.classList.remove('is-started');
        startButton.disabled = false;
        safetyFallback = window.setTimeout(revealSite, 12000);
      });
  };

  startButton.addEventListener('pointerup', startIntro);
  startButton.addEventListener('click', startIntro);

  embed.addEventListener('pointermove', event => {
    if (event.pointerType !== 'touch') showTransientControls();
  });

  embed.addEventListener('pointerleave', hideTransientControls);

  toggleButton.addEventListener('focus', showTransientControls);

  toggleButton.addEventListener('click', () => {
    if (!player || !introStarted) return;

    player.getPaused()
      .then(isPaused => (isPaused ? player.play() : player.pause()))
      .catch(() => {});
  });

  progressButton.addEventListener('click', event => {
    if (!player || !videoDuration) return;

    const rect = progressButton.getBoundingClientRect();
    const percent = (event.clientX - rect.left) / rect.width;
    const safePercent = Math.max(0, Math.min(1, percent));

    player.setCurrentTime(videoDuration * safePercent).catch(() => {});
    updateProgress(safePercent);
  });

  if (!window.Vimeo?.Player) {
    safetyFallback = window.setTimeout(revealSite, 90000);
    return;
  }

  player = new window.Vimeo.Player(iframe);

  player.on('ended', revealSite);
  player.on('error', revealSite);
  player.on('play', () => {
    window.clearTimeout(loadFallback);
    setPausedState(false);
  });
  player.on('pause', () => {
    if (!introFinished) setPausedState(true);
  });
  player.on('timeupdate', data => {
    videoDuration = data.duration || videoDuration;
    updateProgress(data.percent);
  });
  player.on('bufferstart', () => {
    window.clearTimeout(stallFallback);
    stallFallback = window.setTimeout(revealSite, 10000);
  });
  player.on('bufferend', () => {
    window.clearTimeout(stallFallback);
  });

  player.ready()
    .then(() => player.getDuration())
    .then(duration => {
      videoDuration = duration || 0;
    })
    .catch(() => {
      safetyFallback = window.setTimeout(revealSite, 12000);
    });
})();
