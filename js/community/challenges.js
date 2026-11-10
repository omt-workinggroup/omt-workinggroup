// Daily and weekly challenges: answer once, see the explanation, earn XP. Optional leaderboard.
import { initCommunity, api, esc, $, empty, loading, toast, session } from './core.js';
import * as fallback from './fallback.js';

let practice = null; // challenge bank while accounts are not open yet

function challenge(c) {
  const a = c.attempt;
  const options = c.options.map((o, i) => {
    const cls = a ? (i === a.answer ? ' opt--right' : i === a.choice ? ' opt--wrong' : '') : '';
    return `<li><label class="opt${cls}"><input type="radio" name="c-${esc(c.id)}" value="${i}" ${a ? 'disabled' : ''} ${a && a.choice === i ? 'checked' : ''}><span>${esc(o)}</span></label></li>`;
  }).join('');
  return `<article class="chal" data-id="${esc(c.id)}">
    <p class="dcard__kind">${c.weekly ? 'Weekly challenge · 25 XP' : 'Daily challenge · 10 XP'} · ${esc(c.topic)} · ${esc(c.difficulty)}</p>
    <h3>${esc(c.question)}</h3>
    <form class="chal__form"><ol class="opts">${options}</ol>
      ${a ? `<div class="chal__result ${a.correct ? 'is-right' : 'is-wrong'}" role="status"><b>${a.correct ? 'Correct!' : 'Not this time.'}</b> ${esc(a.explanation)}</div>`
        : session() || practice ? `<button class="btn btn--primary" type="submit">${practice ? 'Check my answer' : 'Submit answer'}</button>` : `<p class="signin-note"><a href="account.html?next=challenges.html">Sign in</a> to answer and earn XP.</p>`}
    </form>
  </article>`;
}

async function load() {
  const host = $('#challenges');
  host.innerHTML = loading();
  try {
    const list = practice ?? await api('challenges').catch(async (err) => {
      if (err.code !== 'not_ready') throw err;
      practice = (await fallback.todaysChallenges()).map((c) => ({ ...c, attempt: null }));
      $('#practice-note').hidden = false;
      return practice;
    });
    host.innerHTML = list.length ? list.map(challenge).join('') : empty('No challenges today', 'Check back tomorrow.');
  } catch (err) { host.innerHTML = empty('Could not load', err.message); }
  try {
    const board = await api('leaderboard');
    $('#board').innerHTML = board.length ? board.map((r, i) => `<li><span class="board__n">${i + 1}</span><span>${esc(r.name)}</span><b>${r.xp} XP</b></li>`).join('')
      : '<li class="muted">No one has joined the leaderboard yet. Turn it on in My Space.</li>';
  } catch { $('#board').innerHTML = '<li class="muted">The leaderboard starts when accounts open.</li>'; }
}

document.addEventListener('submit', async (e) => {
  const form = e.target.closest('.chal__form');
  if (!form) return;
  e.preventDefault();
  const card = form.closest('.chal');
  const choice = form.querySelector('input:checked');
  if (!choice) { toast('Choose an answer first.'); return; }
  if (practice) {
    const c = practice.find((x) => x.id === card.dataset.id);
    const pick = Number(choice.value);
    c.attempt = { choice: pick, correct: pick === c.answer, answer: c.answer, explanation: c.explanation };
    toast(c.attempt.correct ? 'Correct!' : 'Not quite. Read the explanation.', c.attempt.correct ? 'ok' : 'info');
    await load();
    return;
  }
  form.querySelector('button').disabled = true;
  try {
    const r = await api('challenge_submit', { id: card.dataset.id, choice: Number(choice.value) });
    toast(r.correct ? (r.first_try ? 'Correct! XP added.' : 'Correct!') : 'Not quite. Read the explanation.', r.correct ? 'ok' : 'info');
    await load();
  } catch (err) { toast(err.message, 'error'); form.querySelector('button').disabled = false; }
});

await initCommunity();
load();
