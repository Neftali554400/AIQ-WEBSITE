(function () {
  const COURSES = [
    'Create Videos Using AI',
    'Write Books Using AI',
    'Create Songs Using AI',
    'Create Motion Graphics Using AI',
    'Create Games Using AI',
    'Animate Images Using AI',
    'Create Websites Using AI',
  ];

  const EVENTS = [
    { action: 'just purchased',              verb: 'purchased',   icon: '💳' },
    { action: 'just enrolled in',            verb: 'enrolled',    icon: '📚' },
    { action: 'just acquired a certificate in', verb: 'certified', icon: '🏅' },
    { action: 'just completed',              verb: 'completed',   icon: '✅' },
  ];

  const NAMES = [
    ['Adewale',   'O'], ['Chiamaka', 'E'], ['Babatunde','A'], ['Ngozi',    'I'],
    ['Emeka',     'U'], ['Funmilayo','B'], ['Chukwuemeka','N'],['Adaeze',  'O'],
    ['Olumide',   'A'], ['Blessing', 'C'], ['Kayode',   'F'], ['Amaka',    'N'],
    ['Segun',     'O'], ['Chidinma', 'A'], ['Rotimi',   'B'], ['Ifeoma',   'O'],
    ['Dapo',      'A'], ['Nneka',    'C'], ['Kunle',    'O'], ['Adaora',   'E'],
    ['Tochukwu',  'N'], ['Yetunde',  'A'], ['Chidi',    'O'], ['Kemi',     'B'],
    ['Uche',      'E'], ['Folake',   'A'], ['Obinna',   'C'], ['Titilayo', 'O'],
    ['Abolaji',   'F'], ['Obiageli', 'N'], ['Femi',     'A'], ['Adunola',  'O'],
    ['Chinedu',   'O'], ['Olawunmi', 'A'], ['Ikenna',   'U'], ['Bunmi',    'O'],
    ['Gbenga',    'A'], ['Ebunoluwa','O'], ['Nnamdi',   'C'], ['Tokunbo',  'A'],
    ['Chinonso',  'E'], ['Wuraola',  'O'], ['Onyeka',   'A'], ['Gbemisola','B'],
    ['Somtochukwu','N'],['Abimbola', 'A'], ['Chukwudi', 'O'], ['Olayinka', 'F'],
    ['Ifeanyi',   'O'], ['Morenike', 'A'], ['Ejike',    'N'], ['Damilola', 'O'],
    ['Olanrewaju','B'], ['Chioma',   'O'], ['Mayowa',   'A'], ['Adaobi',   'C'],
    ['Jide',      'O'], ['Uchenna',  'E'], ['Lekan',    'A'], ['Nkechi',   'O'],
    ['Olawale',   'B'], ['Amarachi', 'N'], ['Biodun',   'A'], ['Ogechi',   'C'],
    ['Adekunle',  'O'], ['Chinwe',   'A'], ['Wale',     'B'], ['Ezinne',   'O'],
    ['Temitope',  'A'], ['Obinna',   'N'], ['Sola',     'O'], ['Adaeze',   'C'],
    ['Kelechi',   'U'], ['Folasade', 'A'], ['Chukwuma', 'O'], ['Olubunmi', 'B'],
    ['Abiodun',   'F'], ['Onyinye',  'C'], ['Gboyega',  'A'], ['Adanna',   'O'],
  ];

  // Shuffle and use as a queue so no name repeats until all are exhausted
  let _nameQueue = [];
  function nextName() {
    if (_nameQueue.length === 0) {
      _nameQueue = NAMES.slice().sort(() => Math.random() - 0.5);
    }
    return _nameQueue.pop();
  }

  const AVATAR_COLORS = [
    '#034f46','#1a6b5a','#2d8a70','#0f4c38',
    '#1d5c47','#3a7a60','#0a3d2e','#256b52',
  ];

  function rand(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  // ── Inject styles ────────────────────────────────────────────────────────────
  const style = document.createElement('style');
  style.textContent = `
    #sp-container {
      position: fixed;
      bottom: 1.5rem;
      left: 1.5rem;
      z-index: 9998;
      pointer-events: none;
    }
    .sp-toast {
      display: flex;
      align-items: center;
      gap: .85rem;
      background: #141412;
      border: 1px solid rgba(255,255,235,.11);
      border-radius: 1rem;
      padding: .75rem 1rem .75rem .85rem;
      box-shadow: 0 12px 40px rgba(0,0,0,.55), 0 2px 8px rgba(0,0,0,.3);
      max-width: 290px;
      pointer-events: all;
      opacity: 0;
      transform: translateX(-18px);
      transition: opacity .35s ease, transform .35s ease;
      margin-top: .6rem;
    }
    .sp-toast.sp-show { opacity: 1; transform: translateX(0); }
    .sp-toast.sp-hide { opacity: 0; transform: translateX(-14px); }
    .sp-avatar {
      width: 38px; height: 38px; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      font-family: 'Figtree', Arial, sans-serif;
      font-size: .8rem; font-weight: 700;
      color: #ffffeb; flex-shrink: 0; letter-spacing: .02em;
    }
    .sp-body { flex: 1; min-width: 0; }
    .sp-name {
      font-family: 'Figtree', Arial, sans-serif;
      font-size: .8rem; font-weight: 600;
      color: rgba(255,255,235,.88); margin-bottom: .12rem;
    }
    .sp-action {
      font-family: 'Figtree', Arial, sans-serif;
      font-size: .74rem; color: rgba(255,255,235,.42);
      line-height: 1.45;
    }
    .sp-action strong {
      color: rgba(255,255,235,.68); font-weight: 600;
    }
    .sp-time {
      font-size: .68rem; color: rgba(255,255,235,.22);
      margin-top: .18rem; font-family: 'Figtree', Arial, sans-serif;
    }
    .sp-dot {
      width: 7px; height: 7px; border-radius: 50%;
      background: #22c55e; flex-shrink: 0; margin-top: 1px;
      box-shadow: 0 0 6px rgba(34,197,94,.5);
    }
    @media (max-width: 480px) {
      #sp-container { left: .75rem; right: .75rem; bottom: 1rem; }
      .sp-toast { max-width: 100%; }
    }
  `;
  document.head.appendChild(style);

  // ── Create container ─────────────────────────────────────────────────────────
  const container = document.createElement('div');
  container.id = 'sp-container';
  document.body.appendChild(container);

  // ── Show one notification ────────────────────────────────────────────────────
  function showNotification() {
    const [firstName, lastInitial] = nextName();
    const event   = rand(EVENTS);
    const course  = rand(COURSES);
    const color   = rand(AVATAR_COLORS);
    const initials = firstName[0] + lastInitial;

    const toast = document.createElement('div');
    toast.className = 'sp-toast';
    toast.innerHTML = `
      <div class="sp-avatar" style="background:${color}">${initials}</div>
      <div class="sp-body">
        <div class="sp-name">${firstName} ${lastInitial}.</div>
        <div class="sp-action">${event.action} <strong>${course}</strong></div>
        <div class="sp-time">just now</div>
      </div>
      <div class="sp-dot"></div>
    `;

    container.appendChild(toast);

    // Animate in
    requestAnimationFrame(() => {
      requestAnimationFrame(() => { toast.classList.add('sp-show'); });
    });

    // Animate out after 4.5s
    setTimeout(() => {
      toast.classList.add('sp-hide');
      toast.addEventListener('transitionend', () => toast.remove(), { once: true });
    }, 4500);
  }

  // ── Schedule loop ────────────────────────────────────────────────────────────
  function scheduleNext() {
    const delay = 9000 + Math.random() * 8000; // 9–17 sec
    setTimeout(() => {
      showNotification();
      scheduleNext();
    }, delay);
  }

  // Only show to non-logged-in users
  try {
    const u = JSON.parse(localStorage.getItem('aiq_user'));
    if (u && u.email) return;
  } catch(e) {}

  // First one appears after 4–7 seconds
  setTimeout(() => {
    showNotification();
    scheduleNext();
  }, 4000 + Math.random() * 3000);
})();
