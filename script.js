const io = new IntersectionObserver(
  entries => entries.forEach(entry => {
    if (entry.isIntersecting) entry.target.classList.add('visible');
  }),
  { threshold: 0.12 }
);

document.querySelectorAll('.fade-in').forEach(element => io.observe(element));


const getEditorialImageFallbacks = image => {
  const source = image.getAttribute('src') || '';
  const fallback = image.dataset.fallbackSrc || '';
  const paths = [source, fallback].filter(Boolean);
  const sourceParts = source.split('/').filter(Boolean);
  const filename = sourceParts[sourceParts.length - 1] || '';

  if (filename) {
    const extensionMatch = filename.match(/^(.*)\.(png|jpe?g|webp)$/i);
    const filenameVariants = extensionMatch
      ? [filename, ...['jpg', 'jpeg', 'png', 'webp'].map(extension => `${extensionMatch[1]}.${extension}`)]
      : [filename];

    [...new Set(filenameVariants)].forEach(candidate => {
      paths.push(
        `/assets/img/${candidate}`,
        `assets/img/${candidate}`,
        `/assets/${candidate}`,
        `assets/${candidate}`,
        `/img/${candidate}`,
        `img/${candidate}`
      );
    });
  }

  return [...new Set(paths)];
};

const hideMissingEditorialImage = image => {
  const editorialPhoto = image.closest('.editorial-photo');

  if (editorialPhoto) {
    editorialPhoto.classList.add('is-missing');
  } else {
    image.hidden = true;
  }
};

document.querySelectorAll('[data-editorial-image]').forEach(image => {
  const fallbackPaths = getEditorialImageFallbacks(image);
  let fallbackIndex = Math.max(0, fallbackPaths.indexOf(image.getAttribute('src')));

  const tryNextImageSource = () => {
    fallbackIndex += 1;

    if (fallbackIndex < fallbackPaths.length) {
      image.src = fallbackPaths[fallbackIndex];
      return;
    }

    hideMissingEditorialImage(image);
  };

  image.addEventListener('error', tryNextImageSource);

  if (image.complete && image.currentSrc && image.naturalWidth === 0) {
    tryNextImageSource();
  }
});

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
