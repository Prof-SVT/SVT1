const progressKey = "atelier-svt-missions-v2";

function readProgress() {
  try {
    const stored = JSON.parse(localStorage.getItem(progressKey) || "[]");
    return new Set(Array.isArray(stored) ? stored.filter(id => /^[1-6]$/.test(id)) : []);
  } catch {
    return new Set();
  }
}

function recordMission(id) {
  const complete = readProgress();
  complete.add(id);
  try {
    localStorage.setItem(progressKey, JSON.stringify([...complete]));
  } catch {
    // The mission still works when local storage is unavailable.
  }
}

function renderProgress(panel) {
  const complete = readProgress();
  const count = complete.size;
  panel.querySelector("progress").value = count;
  panel.querySelector("[data-progress-label]").textContent =
    count === 1 ? "1 / 6 mission terminée" : count + " / 6 missions terminées";
  for (const card of document.querySelectorAll("[data-mission]")) {
    card.toggleAttribute("data-done", complete.has(card.dataset.mission));
  }
  panel.hidden = false;
}

function setupLegCount(step, complete, encourage) {
  const points = [...step.querySelectorAll("[data-point]")];
  const legs = points.filter(point => point.dataset.point === "leg");
  const counter = step.querySelector("[data-counter]");
  const status = step.querySelector("[data-image-status]");
  let count = 0;

  for (const point of points) {
    point.addEventListener("click", () => {
      if (count === legs.length) return;
      if (point.dataset.point === "antenna") {
        status.textContent = "Continue, tu y es presque ! C’est une antenne.";
        encourage("Continue, tu y es presque !");
        point.classList.add("antenna");
        return;
      }
      if (point.getAttribute("aria-pressed") === "true") return;

      count += 1;
      point.setAttribute("aria-pressed", "true");
      point.querySelector("span").textContent = count;
      const label = count + (count === 1 ? " patte comptée" : " pattes comptées");
      counter.textContent = label;
      status.textContent = label + ".";
      if (count === legs.length) complete();
    });
  }

  return () => {
    count = 0;
    counter.textContent = "0 patte comptée";
    status.textContent = "";
    for (const point of points) {
      point.setAttribute("aria-pressed", "false");
      point.classList.remove("antenna");
      point.querySelector("span").textContent = "";
    }
  };
}

function setupPhotoSort(step, complete, encourage) {
  const tiles = [...step.querySelectorAll("[data-tile]")];
  const bins = [...step.querySelectorAll("[data-bin]")];
  const status = step.querySelector("[data-image-status]");
  const originalLabels = bins.map(bin => bin.getAttribute("aria-label"));
  let selected = null;
  let placed = 0;
  let gesture = null;

  function select(tile) {
    if (selected) selected.setAttribute("aria-pressed", "false");
    selected = tile;
    if (tile) tile.setAttribute("aria-pressed", "true");
  }

  function place(tile, bin) {
    if (!tile || tile.getAttribute("aria-disabled") === "true") return;
    const name = tile.querySelector("span").textContent;
    if (bin.getAttribute("aria-disabled") === "true") {
      status.textContent = "Cette place est déjà occupée.";
      return;
    }
    if (bin.dataset.bin !== tile.dataset.tile) {
      status.textContent = name + " · Tu peux réessayer !";
      encourage("Tu peux réessayer !");
      return;
    }

    const group = bin.dataset.label || bin.firstElementChild.textContent;
    const photo = tile.querySelector("img").cloneNode();
    photo.removeAttribute("loading");
    bin.querySelector(".bin-photo").replaceChildren(photo);
    bin.classList.add("placed");
    bin.setAttribute("aria-label", group + " · " + name);
    bin.setAttribute("aria-disabled", "true");
    tile.setAttribute("aria-disabled", "true");
    if (selected === tile) select(null);
    placed += 1;
    status.textContent = name + " · Bien placé ! " + placed + " / " + tiles.length + ".";
    if (placed === tiles.length) complete();
  }

  function binAt(x, y) {
    const bin = document.elementFromPoint(x, y)?.closest("[data-bin]");
    return bins.includes(bin) ? bin : null;
  }

  function highlightBin(x, y) {
    const target = binAt(x, y);
    for (const bin of bins) bin.classList.toggle("over", bin === target);
  }

  // A finger stays captured by the tile while the page scrolls underneath it.
  function scrollWhileDragging() {
    if (!gesture?.ghost) return;
    const { clientX, clientY } = gesture;
    const edge = 64;
    const bottom = window.innerHeight - edge;
    const direction = clientY < edge ? -1 : clientY > bottom ? 1 : 0;
    if (direction) {
      window.scrollBy({ top: direction * 10, behavior: "instant" });
      highlightBin(clientX, clientY);
    }
    gesture.frame = requestAnimationFrame(scrollWhileDragging);
  }

  function endDrag() {
    if (!gesture) return;
    const { tile, pointer, ghost, frame } = gesture;
    gesture = null;
    if (frame !== undefined) cancelAnimationFrame(frame);
    ghost?.remove();
    tile.classList.remove("dragging");
    for (const bin of bins) bin.classList.remove("over");
    if (tile.hasPointerCapture(pointer)) tile.releasePointerCapture(pointer);
  }

  function toggleTile(tile) {
    select(selected === tile ? null : tile);
    status.textContent = selected ? "Choisis un groupe." : "";
  }

  for (const tile of tiles) {
    tile.addEventListener("click", event => {
      if (tile.getAttribute("aria-disabled") === "true") return;
      if (tile.dataset.pointerHandled && event.detail > 0) return;
      toggleTile(tile);
    });

    tile.addEventListener("pointerdown", event => {
      delete tile.dataset.pointerHandled;
      if (gesture || !event.isPrimary || event.button !== 0 ||
          tile.getAttribute("aria-disabled") === "true") return;
      gesture = { tile, pointer: event.pointerId, x: event.clientX, y: event.clientY, ghost: null };
      tile.setPointerCapture(event.pointerId);
    });

    tile.addEventListener("pointermove", event => {
      if (gesture?.pointer !== event.pointerId) return;
      if (!gesture.ghost && Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) < 7) return;
      gesture.clientX = event.clientX;
      gesture.clientY = event.clientY;
      if (!gesture.ghost) {
        const ghost = tile.querySelector("img").cloneNode();
        ghost.className = "sort-ghost";
        ghost.setAttribute("aria-hidden", "true");
        ghost.removeAttribute("loading");
        document.body.append(ghost);
        gesture.ghost = ghost;
        tile.classList.add("dragging");
        select(tile);
        if (event.pointerType !== "mouse") gesture.frame = requestAnimationFrame(scrollWhileDragging);
      }
      gesture.ghost.style.left = event.clientX + "px";
      gesture.ghost.style.top = event.clientY + "px";
      highlightBin(event.clientX, event.clientY);
    });

    tile.addEventListener("pointerup", event => {
      if (gesture?.pointer !== event.pointerId) return;
      const dragged = Boolean(gesture.ghost);
      const target = dragged ? binAt(event.clientX, event.clientY) : null;
      const touchTap = !dragged && event.pointerType === "touch";
      if (dragged || touchTap) tile.dataset.pointerHandled = "true";
      endDrag();
      if (target) place(tile, target);
      if (touchTap) toggleTile(tile);
    });

    for (const type of ["pointercancel", "lostpointercapture"]) {
      tile.addEventListener(type, event => {
        if (gesture?.pointer === event.pointerId) endDrag();
      });
    }
  }

  for (const bin of bins) {
    bin.addEventListener("click", () => {
      if (bin.getAttribute("aria-disabled") === "true") return;
      if (selected) place(selected, bin);
      else status.textContent = "Choisis d’abord une photo.";
    });
  }

  return () => {
    endDrag();
    select(null);
    placed = 0;
    status.textContent = "";
    for (const tile of tiles) {
      tile.removeAttribute("aria-disabled");
      delete tile.dataset.pointerHandled;
    }
    for (const [index, bin] of bins.entries()) {
      bin.classList.remove("placed");
      if (originalLabels[index]) bin.setAttribute("aria-label", originalLabels[index]);
      else bin.removeAttribute("aria-label");
      bin.removeAttribute("aria-disabled");
      bin.querySelector(".bin-photo").replaceChildren();
    }
  };
}

function setupLabReadings(step, complete) {
  const devices = [...step.querySelectorAll("[data-device]")];
  const status = step.querySelector("[data-image-status]");
  let opened = 0;

  for (const device of devices) {
    const value = device.nextElementSibling;
    device.addEventListener("click", () => {
      if (!value.hidden) return;
      device.setAttribute("aria-expanded", "true");
      value.hidden = false;
      opened += 1;
      status.textContent = device.getAttribute("aria-label") + " · " + value.textContent;
      if (opened === devices.length) complete();
    });
  }

  return () => {
    opened = 0;
    status.textContent = "";
    for (const device of devices) {
      device.setAttribute("aria-expanded", "false");
      device.nextElementSibling.hidden = true;
    }
  };
}

function shuffleChoices(step, storageKey) {
  const choices = [...step.querySelectorAll("[data-choice]")];
  if (choices.length < 2) return;
  const order = () => choices.map(choice => choice.dataset.choice).join(",");
  let previous = order();

  try {
    previous = sessionStorage.getItem(storageKey) || previous;
  } catch {
    // The current order still lets us reshuffle without browser storage.
  }

  for (let i = choices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [choices[i], choices[j]] = [choices[j], choices[i]];
  }
  if (order() === previous) choices.push(choices.shift());

  try {
    sessionStorage.setItem(storageKey, order());
  } catch {
    // The shuffled choices remain usable without browser storage.
  }

  const parent = choices[0].parentElement;
  for (const [index, choice] of choices.entries()) {
    choice.firstElementChild.textContent = String.fromCharCode(65 + index);
    parent.append(choice);
  }
}

const finishMessages = [
  ["Bravo d’être allé jusqu’au bout !", "Chaque essai t’aide à progresser. Revois une question à la fois."],
  ["Bien joué, tu as un premier point !", "Appuie-toi sur ce que tu as compris pour reprendre les autres questions."],
  ["Bravo, tu avances !", "Les explications vont t’aider à trouver les réponses qui te manquent."],
  ["Bravo, tu as réussi plus de la moitié !", "Reprends les deux questions qui t’ont fait hésiter."],
  ["Bravo, tu y es presque !", "Il reste une seule question à reprendre."],
  ["Bravo, tout est réussi !", "Tu as relevé les cinq défis."]
];

function startChallenge(challenge) {
  const steps = [...challenge.querySelectorAll("[data-step]")];
  const marks = [...challenge.querySelectorAll(".step-meter i")];
  const stage = challenge.querySelector("[data-stage]");
  const result = challenge.querySelector("[data-result]");
  const score = result.querySelector("[data-score]");
  const finishDialog = document.querySelector("[data-finish-dialog]");
  const resultHeading = result.querySelector("h2");
  const review = result.querySelector("[data-review]");
  const reviewList = review.querySelector("[data-review-list]");
  const finishScore = finishDialog.querySelector("[data-finish-score]");
  const finishTitle = finishDialog.querySelector("#finish-title");
  const finishCopy = finishDialog.querySelector("#finish-copy");
  finishDialog.addEventListener("close", () => resultHeading.focus());
  let position = 0;
  let round = steps;
  const missed = new Set();
  const resets = new Map();
  const corrections = new Map();
  const encouragement = document.querySelector("[data-encouragement]");
  let toastTimer;

  function hideEncouragement() {
    if (!encouragement) return;
    clearTimeout(toastTimer);
    encouragement.hidden = true;
  }

  function encourage(message) {
    if (!encouragement) return;
    hideEncouragement();
    encouragement.textContent = message;
    encouragement.hidden = false;
    toastTimer = setTimeout(hideEncouragement, 2400);
  }

  function showStep(index, focus = true) {
    hideEncouragement();
    position = index;
    result.hidden = true;
    const step = round[index];
    const label = round === steps ? "DÉFI " : "RÉVISION ";
    stage.textContent = label + (index + 1) + " / " + round.length;
    marks.forEach((mark, i) => {
      mark.hidden = i >= round.length;
      mark.classList.toggle("active", i <= index);
    });
    for (const item of steps) item.hidden = item !== step;
    step.querySelector("[data-next]").firstChild.textContent =
      index + 1 === round.length ? "Voir mon bilan " : "Défi suivant ";
    if (focus) step.querySelector("h2").focus();
  }

  function showResult() {
    hideEncouragement();
    round[position].hidden = true;
    const correct = steps.length - missed.size;
    stage.textContent = "MISSION TERMINÉE";
    score.textContent = correct + " / " + steps.length +
      (correct === 1 ? " défi réussi" : " défis réussis");
    reviewList.replaceChildren();
    for (const step of steps) {
      if (!missed.has(step)) continue;
      const { answer, explanation } = corrections.get(step);
      const item = document.createElement("li");
      const heading = document.createElement("h4");
      heading.textContent = step.dataset.step + ". " + step.querySelector("h2").textContent;
      const photo = step.querySelector(".clue img");
      if (photo) item.append(photo.cloneNode());
      const copy = document.createElement("div");
      const correction = document.createElement("p");
      const answerLabel = document.createElement("strong");
      answerLabel.textContent = "Bonne réponse";
      correction.append(answerLabel, " · " + answer);
      const reason = document.createElement("p");
      reason.textContent = explanation;
      copy.append(heading, correction, reason);
      item.append(copy);
      reviewList.append(item);
    }
    review.hidden = missed.size === 0;
    finishScore.textContent = correct + " / " + steps.length;
    const [title, copy] = finishMessages[correct];
    finishTitle.textContent = title;
    finishCopy.textContent = copy;
    recordMission(challenge.dataset.challenge);
    result.hidden = false;
    resultHeading.focus();
    finishDialog.showModal();
  }

  for (const step of steps) {
    const options = [...step.querySelectorAll("[data-choice]")];
    const feedback = step.querySelector("[data-feedback]");
    const status = feedback.querySelector("[role=status]");
    const explanation = step.querySelector("[data-explanation]").content.textContent;
    const answer = options.find(option => option.dataset.choice === step.dataset.answer);
    const answerText = answer?.lastChild.textContent.trim();
    if (answer) corrections.set(step, { answer: answerText, explanation });
    let resetInteraction;

    function complete(message) {
      if (!feedback.hidden) return;
      missed.delete(step);
      feedback.hidden = false;
      status.textContent = message;
      encourage("Bien joué !");
    }

    if (step.dataset.mode === "count") {
      resetInteraction = setupLegCount(step, () => complete(explanation), encourage);
    } else if (step.dataset.mode === "sort") {
      resetInteraction = setupPhotoSort(step, () => complete(explanation), encourage);
    } else if (step.dataset.mode === "read") {
      resetInteraction = setupLabReadings(step, () => complete(explanation));
    }

    for (const option of options) {
      option.addEventListener("click", () => {
        if (!feedback.hidden) return;
        for (const choice of options) choice.setAttribute("aria-disabled", "true");
        option.setAttribute("aria-pressed", "true");
        answer.classList.add("good");
        if (option === answer) {
          complete("Bien vu ! " + explanation);
          return;
        }
        option.classList.add("miss");
        feedback.hidden = false;
        missed.add(step);
        const support = encouragement ? "Continue, tu progresses ! " : "";
        status.textContent = support + "Bonne réponse · " + answerText + ". " + explanation;
        encourage("Continue, tu progresses !");
      });
    }

    step.querySelector("[data-next]").addEventListener("click", () => {
      if (position + 1 < round.length) showStep(position + 1);
      else showResult();
    });
    resets.set(step, () => {
      resetInteraction?.();
      for (const option of options) {
        option.removeAttribute("aria-disabled");
        option.setAttribute("aria-pressed", "false");
        option.classList.remove("good", "miss");
      }
      feedback.hidden = true;
      status.textContent = "";
      for (const hint of step.querySelectorAll(".hint")) hint.open = false;
    });
  }

  function shuffleQuiz() {
    for (const step of round) {
      shuffleChoices(step, "atelier-svt-choices-" + challenge.dataset.challenge + "-" + step.dataset.step);
    }
  }

  function retry(selectedSteps) {
    if (!selectedSteps.length) return;
    round = selectedSteps;
    for (const step of round) resets.get(step)();
    shuffleQuiz();
    showStep(0);
  }

  review.querySelector("[data-retry-missed]").addEventListener("click", () => {
    retry(steps.filter(step => missed.has(step)));
  });

  result.querySelector("[data-retry]").addEventListener("click", () => {
    missed.clear();
    retry(steps);
  });

  shuffleQuiz();
  showStep(0, false);
  challenge.hidden = false;
  const notes = document.querySelector(".field-notes");
  if (notes && location.hash !== "#carnet") notes.open = false;
  for (const link of challenge.querySelectorAll("[data-open-notes]")) {
    link.addEventListener("click", () => {
      hideEncouragement();
      notes.open = true;
      notes.querySelector("summary").focus({ preventScroll: true });
    });
  }
}

const progressPanel = document.querySelector("[data-progress]");
if (progressPanel) {
  renderProgress(progressPanel);
  window.addEventListener("pageshow", () => renderProgress(progressPanel));
}

const challenge = document.querySelector("[data-challenge]");
if (challenge) startChallenge(challenge);


const photoDialog = document.querySelector(".photo-dialog");
if (photoDialog) {
  const image = photoDialog.querySelector("img");
  const closeButton = photoDialog.querySelector("[data-close]");
  for (const button of document.querySelectorAll("[data-zoom]")) {
    button.addEventListener("click", () => {
      const source = button.closest("figure").querySelector("img");
      image.src = source.currentSrc || source.src;
      image.alt = source.alt;
      photoDialog.showModal();
      closeButton.focus();
    });
  }
  closeButton.addEventListener("click", () => photoDialog.close());
}
