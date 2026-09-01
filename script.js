document.getElementById('year').textContent = new Date().getFullYear();

const form = document.getElementById('registerForm');
const msg = document.getElementById('formMessage');
const btn = form.querySelector('button[type="submit"]');

/* --- Lead qualification scoring (BANT-style) ---
   Computed client-side and posted as hidden fields so every submission
   arrives already scored in the Formspree email + CSV export. */
function computeLeadScore(fd) {
  let score = 0;

  const sizePoints = {
    '5,000+': 30, '1,001–5,000': 25, '201–1,000': 15, '51–200': 8, '1–50': 3
  };
  score += sizePoints[fd.get('Company size')] || 0;

  const rolePoints = {
    'C-level (CTO / CIO / etc.)': 25, 'VP': 25, 'Director': 18,
    'Engineering manager': 12, 'Individual contributor': 5
  };
  score += rolePoints[fd.get('Role / seniority')] || 0;

  const maturityPoints = {
    'Rolling out': 25, 'Scaled org-wide': 20, 'Piloting': 15, 'Not started': 5
  };
  score += maturityPoints[fd.get('AI maturity')] || 0;

  const timelinePoints = {
    'Now (within 3 months)': 25, 'This year': 18, 'Next 12 months': 10, 'Just exploring': 3
  };
  score += timelinePoints[fd.get('Timeline to scale AI')] || 0;

  if (fd.get('Open to follow-up') === 'Yes') score += 15;

  const tier = score >= 80 ? 'Hot' : score >= 50 ? 'Warm' : 'Nurture';
  return { score, tier };
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  msg.textContent = '';
  msg.className = 'form-message';

  if (!form.checkValidity()) {
    form.reportValidity();
    return;
  }

  // Attach lead score/tier before building the payload
  const scored = computeLeadScore(new FormData(form));
  document.getElementById('leadScore').value = String(scored.score);
  document.getElementById('leadTier').value = scored.tier;

  btn.disabled = true;
  const originalLabel = btn.textContent;
  btn.textContent = 'Submitting…';

  try {
    const data = new FormData(form);
    const res = await fetch(form.action, {
      method: 'POST',
      body: data,
      headers: { Accept: 'application/json' }
    });

    if (res.ok) {
      form.reset();
      msg.textContent = '✓ You\'re registered! Check your email for the join link and calendar invite.';
      msg.classList.add('success');
    } else {
      const body = await res.json().catch(() => ({}));
      msg.textContent = body?.error || body?.errors?.[0]?.message || 'Something went wrong. Please try again.';
      msg.classList.add('error');
    }
  } catch (err) {
    msg.textContent = 'Network error. Please check your connection and try again.';
    msg.classList.add('error');
  } finally {
    btn.disabled = false;
    btn.textContent = originalLabel;
  }
});
