// Free registration form, shared by the company homepage and the resources pages (and the app).
// Posts JSON to /api/register, which saves it and emails it to the owner.

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function bindRegisterForm(form) {
  if (!form) return;
  const status = form.querySelector('.reg__status');
  const button = form.querySelector('button[type="submit"]');
  const interests = [...form.querySelectorAll('input[name="interests"]')];

  // At least one interest: the browser has no "required" for checkbox groups, so set it by hand.
  const checkInterests = () => interests[0]?.setCustomValidity(interests.some((i) => i.checked) ? '' : 'Please choose at least one area of interest.');
  interests.forEach((i) => i.addEventListener('change', checkInterests));
  checkInterests();

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const data = new FormData(form);
    const inApp = document.documentElement.classList.contains('in-app');
    const payload = {
      source: inApp ? 'app' : form.dataset.source,
      name: data.get('name'),
      email: data.get('email'),
      phone: data.get('phone'),
      location: data.get('location'),
      organisation: data.get('organisation'),
      role: data.get('role'),
      interests: data.getAll('interests'),
      message: data.get('message'),
      consent: data.get('consent') === 'on',
      company: data.get('company'),
    };
    button.disabled = true;
    status.textContent = 'Sending your registration…';
    try {
      const res = await fetch('/api/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const result = await res.json().catch(() => null);
      if (res.ok && result?.ok) {
        const first = String(payload.name).trim().split(/\s+/)[0];
        form.outerHTML = `<div class="reg reg--done" role="status" tabindex="-1">
          <div class="reg__tick" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg></div>
          <h3>You're registered, ${esc(first)}!</h3>
          <p>Thank you for joining OMT Working Group. We've received your details and our team will be in touch by email or WhatsApp.</p>
        </div>`;
        document.querySelector('.reg--done')?.focus();
      } else {
        status.textContent = result?.error?.message ?? 'Your registration couldn\'t be sent. Please try again in a moment.';
      }
    } catch {
      status.textContent = navigator.onLine ? 'Your registration couldn\'t be sent. Please try again in a moment.' : 'You appear to be offline. Please try again when you\'re connected.';
    } finally {
      button.disabled = false;
    }
  });
}
