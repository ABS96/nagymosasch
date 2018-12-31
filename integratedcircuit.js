const suffix = {
  level: '. szint',
  time: ' perc'
};
const firstValidLevel = 3;
const lastValidLevel = 18;
const shortAnimDuration = 300;
const longAnimDuration = 600;
const imminent = 2;

const maxDigits = {
  level: Math.floor(Math.log10(lastValidLevel)),
  time: 2
};
const machines = [];
const input = document.getElementById('display-input');
const contextElement = document.getElementById('display-context');
const levels = document.getElementById('levels');
document.documentElement.style.setProperty(
  '--shortAnimDuration',
  shortAnimDuration + 'ms'
);
document.documentElement.style.setProperty(
  '--longAnimDuration',
  longAnimDuration + 'ms'
);

/* ---------- */

const minutesToMillisecs = time => {
  return 1000 * 60 * time;
};

let context;
const setContext = newContext => {
  context = newContext;
  contextElement.textContent = suffix[context];
};

const getMachineIndex = m => {
  return machines
    .map(function(item) {
      return item.level;
    })
    .indexOf(m);
};

const addMachine = (level, minutes) => {
  let timeLeft = minutesToMillisecs(minutes);
  let timeExact = Date.now() + timeLeft;

  let index = 0;
  while (index < machines.length && timeExact > machines[index].time) {
    ++index;
  }

  machines.splice(index, 0, {
    level: level,
    time: timeExact,
    dragging: false,
    delays: []
  });
  let machine = machines[index];

  let timeObject = new Date(timeExact);
  let mainText = document.createTextNode(level + '. – ');
  let timeText = document.createTextNode(
    [
      String(timeObject.getHours()).padStart(2, '0'),
      ':',
      String(timeObject.getMinutes()).padStart(2, '0')
    ].join('')
  );
  let subElem = document.createElement('span');
  subElem.appendChild(timeText);
  let elem = document.createElement('p');
  elem.id = level;
  elem.appendChild(mainText);
  elem.appendChild(subElem);
  elem.addEventListener('mousedown', lock, false);
  elem.addEventListener('touchstart', lock, false);
  elem.addEventListener('mouseup', checkDismiss, false);
  elem.addEventListener('touchend', checkDismiss, false);
  elem.addEventListener('mousemove', drag, false);
  elem.addEventListener('touchmove', drag, false);
  if (machines.length == 1 || index == machines.length - 1) {
    levels.appendChild(elem);
  } else {
    levels.insertBefore(
      elem,
      document.getElementById(machines[index + 1].level)
    );
  }
  machine.element = elem;

  machine.delays.push(
    setTimeout(() => {
      removeMachine(level);
    }, timeLeft)
  );

  console.log(minutes + ' ' + imminent);
  if (minutes <= imminent) {
    highlightMachine(level);
  } else {
    machine.delays.push(
      setTimeout(() => {
        highlightMachine(level);
      }, timeLeft - minutesToMillisecs(imminent))
    );
  }
};

const removeMachine = level => {
  let machine = machines[getMachineIndex(level)];
  let animTime, animArray;
  if (Date.now() < machine.time) {
    animTime = longAnimDuration;
    animArray = [
      { transform: 'translateX(0)' },
      {
        transform: `translateX(${Math.sign(
          Number(machine.element.style.marginLeft.slice(0, -2))
        )}100%)`
      }
    ];
    for (timeout in machine.delays) {
      clearTimeout(timeout);
    }
  } else {
    animTime = shortAnimDuration;
    animArray = [{ transform: 'scale(1)' }, { transform: 'scale(0)' }];
  }
  machine.element.animate(animArray, {
    duration: animTime,
    easing: 'ease-in'
  });
  setTimeout(() => {
    machine.element.parentNode.removeChild(machine.element);
    machines.splice(getMachineIndex(level), 1);
  }, animTime);
};

const highlightMachine = level => {
  machines[getMachineIndex(level)].element.classList.add('imminent');
};

// Gesture detection

const unify = e => {
  return e.changedTouches ? e.changedTouches[0] : e;
};

let x0, y0;
const lock = e => {
  x0 = unify(e).clientX;
  y0 = unify(e).clientY;
  e.target.classList.remove('smooth');
  machines[getMachineIndex(e.target.id)].dragging = true;
};

const drag = e => {
  if (!machines[getMachineIndex(e.target.id)].dragging) {
    return;
  }
  let dx = unify(e).clientX - x0;
  e.target.style.marginLeft = dx + 'px';
};

const checkDismiss = e => {
  const threshold = 150;
  const restraint = 100;
  machines[getMachineIndex(e.target.id)].dragging = false;
  let dx = unify(e).clientX - x0;
  let dy = unify(e).clientY - y0;
  if (Math.abs(dx) >= threshold && Math.abs(dy) < restraint) {
    removeMachine(e.target.id);
  } else {
    e.target.classList.add('smooth');
    e.target.style.marginLeft = null;
  }
};

/* ---------- */

setContext('level');

let buttons = document.getElementsByClassName('numeric-button');
for (let i = 0; i < buttons.length; ++i) {
  buttons[i].addEventListener(
    'click',
    event => {
      if (input.textContent.length <= maxDigits[context]) {
        input.textContent += event.target.textContent;
      }
    },
    false
  );
}

document.getElementById('delete').addEventListener(
  'click',
  () => {
    if (context == 'time' && input.textContent.length == 0) {
      setContext('level');
      input.textContent = currentLevel;
    } else {
      input.textContent = input.textContent.slice(0, -1);
    }
  },
  false
);

let currentLevel;
document.getElementById('enter').addEventListener(
  'click',
  () => {
    if (input.textContent.length == 0) {
      return;
    }
    if (context == 'level') {
      currentLevel = input.textContent;
      if (currentLevel < firstValidLevel || currentLevel > lastValidLevel) {
        input.textContent = '';
        return;
      }
      for (let i = 0; i < machines.length; ++i) {
        if (currentLevel == machines[i].level) {
          input.textContent = '';
          return;
        }
      }
      setContext('time');
    } else {
      addMachine(currentLevel, Number(input.textContent));
      setContext('level');
    }
    input.textContent = '';
  },
  false
);

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./serviceworker.js');
}
