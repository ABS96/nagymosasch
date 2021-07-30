// SETTINGS

const highlightTime = 2 * 60 * 1000;
const shortAnimDuration = 300;
const longAnimDuration = 600;

const firstValidLevel = 3;
const lastValidLevel = 18;
const maxDigits = {
  level: Math.floor(Math.log10(lastValidLevel)),
  time: 2,
};

// GLOBAL OBJECTS

let db;
let eventQueue = [];
let draggedElementLevel = null;

let context;
let currentLevel;
const machinesElement = document.getElementById('levels');
const inputElement = document.getElementById('display-input');
const contextElement = document.getElementById('display-context');

// DATABASE METHODS

const getElementLevel = (text) => Number(text.match(/\d+/)[0]);

const connectToDB = () => {
  return new Promise((resolve, reject) => {
    const reqOpen = window.indexedDB.open('NagymosaSCH', 2);

    reqOpen.onerror = () => {
      reject('Cannot connect to database');
    };

    reqOpen.onupgradeneeded = (e) => {
      db = e.target.result;

      const objectStore = db.createObjectStore('machines', {
        keyPath: 'level',
      });
      objectStore.createIndex('expiresAt', 'expiresAt', { unique: false });
    };

    reqOpen.onsuccess = (e) => {
      db = e.target.result;
      db.onerror = (e) => {
        console.error('Database error: ' + e);
      };
      resolve();
    };
  });
};

const executeDB = (action, params) => {
  return new Promise((resolve, reject) => {
    const knownActions = ['getAll', 'add', 'remove'];
    if (!knownActions.includes(action)) {
      reject('Unknown database action');
    }

    switch (action) {
      case 'getAll':
        getAllMachines().then((machines) => resolve(machines));
        break;
      case 'add':
        if (params.length < 1)
          reject('Cannot add non-existent machine to database');
        else addMachine(params[0]).then(resolve());
        break;
      case 'remove':
        if (params.length < 1)
          reject('No machine was specified to remove from database');
        else removeMachine(params[0]);
        break;
    }
  });
};

const indexedDBAccessor = (action, params = []) => {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) reject('IndexedDB API is not available');
    if (!db) {
      connectToDB().then(() => {
        resolve(executeDB(action, params));
      });
    } else {
      resolve(executeDB(action, params));
    }
  });
};

const getAllMachines = () => {
  // console.log('Getting all machines (ordered by expiry time)');
  return new Promise((resolve, reject) => {
    const allMachines = new Array();

    let reqCursor = db
      .transaction(['machines'], 'readonly')
      .objectStore('machines')
      .index('expiresAt')
      .openCursor();

    reqCursor.onerror = (e) => reject(e);

    reqCursor.onsuccess = (e) => {
      const cursor = e.target.result;
      if (cursor) {
        allMachines.push(cursor.value);
        cursor.continue();
      } else {
        resolve(allMachines);
      }
    };
  });
};

const addMachine = (machine) => {
  // console.log(
  //   `Adding machine ${machine.level} (${machine.expiresAt}) to database`,
  // );
  return new Promise((resolve, reject) => {
    const reqAdd = db
      .transaction(['machines'], 'readwrite')
      .objectStore('machines')
      .add(machine);

    reqAdd.onerror = (e) => reject(e);
    reqAdd.onsuccess = () => resolve();
  });
};

const removeMachine = (level) => {
  // console.log(`Removing machine ${level} from database`);
  return new Promise((resolve, reject) => {
    const reqDelete = db
      .transaction(['machines'], 'readwrite')
      .objectStore('machines')
      .delete(level);

    reqDelete.onerror = (e) => reject(e);
    reqDelete.onsuccess = resolve();
  });
};

// DOM METHODS

const getMachineElementId = (level) => `machine-${level}`;

const createMachineItem = ({ level, expiresAt }, index) => {
  // console.log('Adding machine to DOM at index ' + index);

  const date = new Date(expiresAt);
  const text = document.createTextNode(
    `${level} . – ${String(date.getHours()).padStart(2, '0')}:${String(
      date.getMinutes(),
    ).padStart(2, '0')}`,
  );
  const element = document.createElement('p');
  element.id = getMachineElementId(level);
  element.appendChild(text);
  element.addEventListener('mousedown', handleGrab, false);
  element.addEventListener('touchstart', handleGrab, false);
  if (levels.children.length === 0) {
    levels.appendChild(element);
  } else {
    levels.insertBefore(element, levels.children[index]);
  }

  eventQueue.push({
    level,
    timeoutId: setTimeout(() => {
      indexedDBAccessor('remove', [level]);
      removeMachineItem(level);
    }, expiresAt - Date.now()),
  });
  const highlightDelta = expiresAt - Date.now() - highlightTime;
  if (highlightDelta <= 0) {
    highlightMachine(level, false);
  } else {
    eventQueue.push({
      level,
      timeoutId: setTimeout(() => {
        highlightMachine(level, true);
      }, highlightDelta),
    });
  }
};

const highlightMachine = (level, notify) => {
  // console.log('Highlighting machine ' + level);
  document.getElementById(getMachineElementId(level)).classList.add('imminent');

  if (notify) {
    navigator.serviceWorker.controller.postMessage({
      command: 'showNotification',
      delta: Math.floor(highlightTime / (60 * 1000)),
      level,
    });
  }
};

const removeMachineItem = (level) => {
  const element = document.getElementById(getMachineElementId(level));
  if (!element) {
    return;
  }

  eventQueue
    .filter((a) => a.level === level)
    .forEach((animation) => clearTimeout(animation.timeoutId));
  eventQueue = eventQueue.filter((a) => a.level !== level);

  let animArray;
  let animDuration;
  manual = draggedElementLevel === level;

  // console.log('Removing machine ' + level + (manual ? ' manually' : ''));

  if (manual) {
    draggedElementLevel = null;
    animArray = [
      { transform: 'translateX(0)' },
      {
        transform: `translateX(${Math.sign(
          Number(element.style.marginLeft.slice(0, -2)),
        )}100%)`,
      },
    ];
    animDuration = longAnimDuration;
  } else {
    animArray = [{ transform: 'scale(1)' }, { transform: 'scale(0)' }];
    animDuration = shortAnimDuration;
  }
  element.animate(animArray, {
    duration: animDuration,
    easing: 'ease-in',
  });
  setTimeout(() => {
    element.remove();
  }, animDuration);
};

const loadMachines = () => {
  // console.log('Loading saved machines...');

  let cursor = 0;
  indexedDBAccessor('getAll').then((machines) => {
    for (let i = 0; i < machines.length; ++i) {
      const m = machines[i];
      if (m.expiresAt <= Date.now()) {
        // Purge expired machines
        // console.log(`Machine ${m.level} is expired, removing`);
        indexedDBAccessor('remove', [m.level]);
      } else {
        // Add the rest to DOM
        createMachineItem(machines[i], cursor++);
      }
    }
  });
};

const setContext = (newContext) => {
  const suffix = {
    level: '. szint',
    time: ' perc',
  };
  context = newContext;
  contextElement.textContent = suffix[newContext];
};

// DOM EVENT HANDLERS

const askForNotificationPermission = () => {
  Notification.requestPermission().then((result) => {
    if (result === 'granted') {
      document.getElementById('notification-request').remove();
    }
  });
};

const sendInput = (char) => {
  // console.log(`Pressed ${char}`);
  if (inputElement.textContent.length <= maxDigits[context]) {
    inputElement.textContent += char;
  }
};

const deleteInput = () => {
  if (context === 'time' && inputElement.textContent.length === 0) {
    setContext('level');
    inputElement.textContent = currentLevel;
  } else {
    inputElement.textContent = inputElement.textContent.slice(0, -1);
  }
};

const submitInput = () => {
  // console.log('Submitting');
  if (inputElement.textContent.length === 0) {
    return;
  }
  switch (context) {
    case 'level':
      indexedDBAccessor('getAll').then((machines) => {
        currentLevel = Number(inputElement.textContent);
        if (
          currentLevel >= firstValidLevel &&
          currentLevel <= lastValidLevel &&
          machines.every((machine) => machine.level !== currentLevel)
        ) {
          setContext('time');
        }
        inputElement.textContent = '';
      });
      break;
    case 'time':
      const minutes = Number(inputElement.textContent);
      if (minutes !== 0) {
        setContext('level');
        indexedDBAccessor('getAll').then((machines) => {
          const machine = {
            level: currentLevel,
            expiresAt: Date.now() + minutes * 60 * 1000,
          };
          const index = machines.findIndex(
            (m) => m.expiresAt > machine.expiresAt,
          );

          indexedDBAccessor('add', [machine]);
          createMachineItem(machine, index > -1 ? index : machines.length);
        });
      }
      inputElement.textContent = '';
      break;
  }
};

// POINTER EVENT HANDLERS

let pointerStartCoordinates = { x: 0, y: 0 };

const unify = (e) => (e.changedTouches ? e.changedTouches[0] : e);

const handleGrab = (e) => {
  draggedElementLevel = getElementLevel(e.target.id);
  // console.log('Grabbed ' + draggedElementLevel);
  e.target.classList.remove('smooth');
  pointerStartCoordinates = {
    x: unify(e).clientX,
    y: unify(e).clientY,
  };
};

const handleMove = (e) => {
  if (draggedElementLevel) {
    const currentlyDraggedElement = document.getElementById(
      getMachineElementId(draggedElementLevel),
    );
    currentlyDraggedElement.style.marginLeft = `${
      unify(e).clientX - pointerStartCoordinates.x
    }px`;
  }
};

const handleRelease = (e) => {
  if (!draggedElementLevel) {
    return;
  }

  const dxMin = 150;
  const dyMax = 100;
  const dx = Math.abs(unify(e).clientX - pointerStartCoordinates.x);
  const dy = Math.abs(unify(e).clientY - pointerStartCoordinates.y);
  const element = document.getElementById(
    getMachineElementId(draggedElementLevel),
  );

  // console.log(`Released ${draggedElementLevel} (dx: ${dx}, dy: ${dy})`);

  if (dx >= dxMin && dy <= dyMax) {
    indexedDBAccessor('remove', [draggedElementLevel]);
    removeMachineItem(draggedElementLevel);
  } else {
    element.classList.add('smooth');
    element.style.marginLeft = null;
  }

  draggedElementLevel = null;
};

// INIT

const initDom = () => {
  setContext('level');

  // Animation timings
  document.documentElement.style.setProperty(
    '--shortAnimDuration',
    shortAnimDuration + 'ms',
  );
  document.documentElement.style.setProperty(
    '--longAnimDuration',
    longAnimDuration + 'ms',
  );

  // Input
  const numericButtons = document.getElementsByClassName('numeric-button');
  for (let i = 0; i < numericButtons.length; ++i) {
    numericButtons[i].addEventListener(
      'click',
      (e) => sendInput(e.target.textContent),
      false,
    );
  }
  document
    .getElementById('delete')
    .addEventListener('click', () => deleteInput(), false);
  document
    .getElementById('enter')
    .addEventListener('click', () => submitInput(), false);
  document.addEventListener('keydown', (e) => {
    // console.log(e.key);
    if (/^\d$/.test(e.key)) {
      sendInput(e.key);
    }
    if (['Backspace', 'Delete', 'Clear'].includes(e.key)) {
      deleteInput();
    }
    if (e.key === 'Enter') {
      submitInput();
    }
  });
  document.addEventListener('mousemove', handleMove, false);
  document.addEventListener('touchmove', handleMove, false);
  document.addEventListener('mouseup', handleRelease, false);
  document.addEventListener('touchend', handleRelease, false);

  const notificationRequestBlip = document.getElementById(
    'notification-request',
  );

  if (Notification.permission === 'granted') {
    notificationRequestBlip.remove();
  } else {
    notificationRequestBlip.addEventListener(
      'click',
      askForNotificationPermission,
      false,
    );
    notificationRequestBlip.addEventListener(
      'touchstart',
      askForNotificationPermission,
      false,
    );
  }

  loadMachines();
};

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./serviceworker.js');
}
initDom();
