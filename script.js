const io = new IntersectionObserver(
  entries => entries.forEach(entry => {
    if (entry.isIntersecting) entry.target.classList.add('visible');
  }),
  { threshold: 0.12 }
);

document.querySelectorAll('.fade-in').forEach(element => io.observe(element));

(() => {
  const body = document.body;
  const intro = document.getElementById('video-intro');
  const iframe = document.getElementById('intro-vimeo');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (!intro || !iframe) {
    body.classList.remove('intro-active');
    body.classList.add('site-ready');
    return;
  }

  let introFinished = false;
  let loadFallback;
  let stallFallback;
  let safetyFallback;
  let player;

  const clearTimers = () => {
    window.clearTimeout(loadFallback);
    window.clearTimeout(stallFallback);
    window.clearTimeout(safetyFallback);
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

  if (!window.Vimeo?.Player) {
    safetyFallback = window.setTimeout(revealSite, 45000);
    return;
  }

  player = new window.Vimeo.Player(iframe);

  player.on('ended', revealSite);
  player.on('error', revealSite);
  player.on('play', () => {
    window.clearTimeout(loadFallback);
  });
  player.on('bufferstart', () => {
    window.clearTimeout(stallFallback);
    stallFallback = window.setTimeout(revealSite, 10000);
  });
  player.on('bufferend', () => {
    window.clearTimeout(stallFallback);
  });

  loadFallback = window.setTimeout(revealSite, 15000);
  safetyFallback = window.setTimeout(revealSite, 60000);

  player.ready()
    .then(() => player.setVolume(1).catch(() => {}))
    .then(() => player.setMuted(false).catch(() => {}))
    .then(() => player.play())
    .catch(() => {
      safetyFallback = window.setTimeout(revealSite, 12000);
    });
})();
