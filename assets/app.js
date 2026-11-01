(() => {
const C = window.SAHL;
const sb = window.supabase.createClient(C.supabaseUrl, C.supabaseAnonKey);
const view = document.getElementById('view');
const nav = document.getElementById('nav');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const toast = (t) => { const e = document.getElementById('toast'); e.textContent = t; e.classList.add('show'); clearTimeout(e._t); e._t = setTimeout(() => e.classList.remove('show'), 2600); };
const loading = () => view.innerHTML = '<div class="loading"><span></span></div>';
const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
// رابط مباشر بدون تحويلات وسيطة: على الجوال يفتح تطبيق الواتساب فوراً
const waLink = (msg, phone = C.whatsapp) => {
  const q = `phone=${phone}${msg ? '&text=' + encodeURIComponent(msg) : ''}`;
  return `whatsapp://send?${q}`;
};
const waNum = n => { n = String(n || '').replace(/[^\d]/g, '').replace(/^00/, ''); return n.length === 8 ? '968' + n : n; };
const waWeb = (msg, phone = C.whatsapp) => `https://api.whatsapp.com/send?phone=${phone}${msg ? '&text=' + encodeURIComponent(msg) : ''}`;
// لو الواتساب مو مثبت على الجوال، نرجع لرابط الويب بعد لحظة
document.addEventListener('click', e => {
  const a = e.target.closest('a[href^="whatsapp://"]'); if (!a) return;
  const fb = a.dataset.web; const t = setTimeout(() => { if (!document.hidden && document.hasFocus() && fb) window.open(fb, '_blank', 'noopener'); }, 1800);
  const stop = () => clearTimeout(t);
  document.addEventListener('visibilitychange', stop, { once: true }); window.addEventListener('blur', stop, { once: true });
});
const AR = n => String(n).replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[d]);

let state = { session: null, profile: null, lessons: null };

async function loadSession() {
  const { data } = await sb.auth.getSession();
  state.session = data.session;
  state.profile = null;
  if (state.session) {
    const { data: p } = await sb.from('profiles').select('*').eq('id', state.session.user.id).maybeSingle();
    state.profile = p;
  }
}
async function lessons() {
  if (state.lessons) return state.lessons;
  const { data, error } = await sb.from('lessons').select('*').order('unit').order('ord');
  if (error) throw error;
  return (state.lessons = data || []);
}
const approved = () => state.profile && (state.profile.approved || state.profile.is_admin);

function renderNav() {
  const s = state.session, p = state.profile;
  let h = '';
  if (!s) h = `<a class="btn ghost small" href="#/login">تسجيل الدخول</a><a class="btn small" href="#/register">اشترك الآن</a>`;
  else {
    h = `<a class="btn ghost small" href="#/course">دروسي</a>`;
    if (p && p.is_admin) h += `<a class="btn ghost small" href="#/admin">لوحة الإدارة</a>`;
    h += `<button class="btn ghost small" id="logout">خروج</button>`;
  }
  nav.innerHTML = h;
  const lo = document.getElementById('logout');
  if (lo) lo.onclick = async () => { await sb.auth.signOut(); state.profile = null; location.hash = '#/'; };
}

function groupUnits(ls) {
  const units = [];
  ls.forEach(l => { let u = units.find(x => x.unit === l.unit); if (!u) units.push(u = { unit: l.unit, title: l.unit_title, items: [] }); u.items.push(l); });
  return units;
}
const PLANNED = [
  [2, 'من الدرس إلى فكرة لعبة', 4], [3, 'تصميم يحبه الأطفال', 3], [4, 'البناء بالذكاء الاصطناعي', 4],
  [5, 'النشر والمشاركة', 3], [6, 'حوّلها إلى خدمة مدفوعة', 4]
];

function curriculumHTML(ls, opts = {}) {
  const done = opts.done || new Set();
  const units = groupUnits(ls);
  let h = units.map(u => `
    <div class="card unit">
      <div class="unit-head"><div><div class="n">الوحدة ${AR(u.unit)}</div><h3>${esc(u.title)}</h3></div><span class="chip">${AR(u.items.length)} دروس</span></div>
      ${u.items.map(l => {
        const open = opts.member || l.free_preview;
        const tag = open ? 'a' : 'div';
        const href = open ? ` href="#/lesson/${l.id}"` : '';
        return `<${tag} class="lesson-row ${done.has(l.id) ? 'done' : ''} ${open ? '' : 'lock'}"${href}>
          <span class="num">${done.has(l.id) ? '✓' : AR(l.ord)}</span>
          <span class="t"><b>${esc(l.title)}</b><small>${esc(l.summary || '')}</small></span>
          <span class="meta">${l.kind === 'تطبيق عملي' ? '<span class="chip">تطبيق عملي</span>' : ''}${l.free_preview && !opts.member ? '<span class="chip ok">مجاني</span>' : ''}<span>${AR(l.minutes || '')} د</span>${open ? '' : '🔒'}</span>
        </${tag}>`;
      }).join('')}
    </div>`).join('');
  const have = new Set(units.map(u => u.unit));
  h += PLANNED.filter(([n]) => !have.has(n)).map(([n, t, c]) => `
    <div class="card unit"><div class="unit-head"><div><div class="n">الوحدة ${AR(n)}</div><h3>${t}</h3></div><span class="chip warn">قريباً · ${AR(c)} دروس</span></div></div>`).join('');
  return h;
}

/* ---------- pages ---------- */
async function pageHome() {
  loading();
  let ls = [];
  try { ls = await lessons(); } catch (e) {}
  const member = approved();
  view.innerHTML = `
  <section class="hero">
    <div>
      <span class="chip">كورس مسجّل · بالعربي · خطوة بخطوة</span>
      <h1 style="margin-top:14px">${esc(C.courseTitle.split(' ').slice(0, 2).join(' '))} <em>${esc(C.courseTitle.split(' ').slice(2).join(' '))}</em></h1>
      <p class="lead">${esc(C.courseTagline)}</p>
      <div class="cta">
        ${member ? `<a class="btn" href="#/course">كمّل التعلّم</a>` : `<a class="btn" href="#/register">اشترك الآن</a>`}
        <a class="btn ghost" href="#curriculum">شوف المحتوى</a>
      </div>
      <div class="stats"><div><b>${AR(6)}</b><span>وحدات</span></div><div><b>${AR(21)}</b><span>درس مسجّل</span></div><div><b>${AR(1)}</b><span>لعبة منشورة باسمك</span></div></div>
    </div>
    <div class="hero-art">
      <img src="assets/logo.png" alt="شعار سهل ستور">
      <div class="badge" style="top:12%;right:8%">🎮 ألعاب تعليمية</div>
      <div class="badge" style="bottom:14%;left:8%">🤖 بالذكاء الاصطناعي</div>
      <div class="badge" style="bottom:30%;right:6%">💼 خدمة تبيعها</div>
    </div>
  </section>

  <section class="block">
    <h2>وش بتطلع فيه؟</h2>
    <p class="sub">مو بس فيديوهات — كل وحدة تنتهي بشي ملموس تقدر تستخدمه.</p>
    <div class="grid3">
      <div class="card feature"><div class="ic">١</div><h3>لعبة تعليمية منشورة</h3><p>تبني لعبة حقيقية من درس تختاره، وتنشرها برابط وQR للطلاب.</p></div>
      <div class="card feature"><div class="ic">٢</div><h3>طريقة ثابتة لأي درس</h3><p>من تفكيك الدرس إلى أهداف، لاختيار نوع اللعبة، لكتابة السيناريو.</p></div>
      <div class="card feature"><div class="ic">٣</div><h3>خدمة جاهزة للبيع</h3><p>باقات وتسعير وطريقة عرض على المدارس والمراكز التعليمية.</p></div>
    </div>
  </section>

  <section class="block" id="curriculum">
    <h2>محتوى الكورس</h2>
    <p class="sub">الدرس الأول مجاني — سجّل دخول وشوفه.</p>
    ${curriculumHTML(ls, { member })}
  </section>

  ${member ? '' : `
  <section class="block" id="price">
    <div class="card price">
      <div class="l">
        <h2 style="font-size:26px;margin-bottom:16px">كيف تشترك؟</h2>
        <ol class="steps-list">
          <li><span><b>سجّل حسابك</b> في المنصة بإيميلك.</span></li>
          <li><span><b>ادفع عبر الواتساب</b> — نرسل لك طريقة الدفع.</span></li>
          <li><span><b>نفعّل حسابك</b> وتفتح لك كل الدروس والملحقات.</span></li>
        </ol>
        <a class="btn" href="#/register" style="margin-top:8px">ابدأ التسجيل</a>
      </div>
      <div class="r">
        <div style="opacity:.9;margin-bottom:6px">${esc(C.launchNote)}</div>
        <div class="amount">${AR(C.launchPrice)} <small>${esc(C.currency)}</small><s>${AR(C.price)} ${esc(C.currency)}</s></div>
        <ul class="checks" style="margin-top:20px">
          <li>كل الدروس المسجّلة والتحديثات القادمة</li>
          <li>ملحقات لكل درس: ملخصات وقوالب وملفات</li>
          <li>لعبة «مغامرة قطرة الماء» كاملة كمرجع</li>
          <li>وصول دائم من الجوال أو الكمبيوتر</li>
        </ul>
      </div>
    </div>
  </section>`}`;
}

function authCard(kind) {
  const isReg = kind === 'register';
  view.innerHTML = `
  <div class="card auth">
    <h1>${isReg ? 'إنشاء حساب' : 'تسجيل الدخول'}</h1>
    <p class="sub">${isReg ? 'سجّل، وبعد الدفع عبر الواتساب نفعّل لك الكورس.' : 'أهلاً فيك من جديد 👋'}</p>
    <div class="err" id="err"></div>
    <form id="f">
      ${isReg ? `<label class="field"><span>الاسم</span><input name="full_name" required autocomplete="name"></label>
      <label class="field"><span>رقم الواتساب</span><input name="phone" required dir="ltr" inputmode="tel" placeholder="+968"></label>` : ''}
      <label class="field"><span>الإيميل</span><input name="email" type="email" required dir="ltr" autocomplete="email"></label>
      <label class="field"><span>كلمة المرور</span><input name="password" type="password" required minlength="6" dir="ltr" autocomplete="${isReg ? 'new-password' : 'current-password'}"></label>
      <button class="btn" style="width:100%" id="go">${isReg ? 'إنشاء الحساب' : 'دخول'}</button>
    </form>
    <div class="alt">${isReg ? 'عندك حساب؟ <a href="#/login">سجّل دخول</a>' : 'ما عندك حساب؟ <a href="#/register">اشترك الآن</a> · <a href="#/reset">نسيت كلمة المرور؟</a>'}</div>
  </div>`;
  const f = document.getElementById('f'), err = document.getElementById('err'), go = document.getElementById('go');
  f.onsubmit = async (e) => {
    e.preventDefault(); err.classList.remove('show'); go.disabled = true;
    const d = Object.fromEntries(new FormData(f));
    try {
      if (isReg) {
        const { data, error } = await sb.auth.signUp({ email: d.email.trim(), password: d.password,
          options: { data: { full_name: d.full_name.trim(), phone: d.phone.trim() }, emailRedirectTo: location.origin + location.pathname + '#/course' } });
        if (error) throw error;
        if (!data.session) { view.innerHTML = `<div class="card pending"><div class="big">📩</div><h1>تأكد من إيميلك</h1><p>أرسلنا رابط تأكيد إلى <b dir="ltr">${esc(d.email)}</b>. اضغط عليه، وبعدها سجّل دخول.</p><a class="btn" href="#/login">تسجيل الدخول</a></div>`; return; }
      } else {
        const { error } = await sb.auth.signInWithPassword({ email: d.email.trim(), password: d.password });
        if (error) throw error;
      }
      await loadSession(); renderNav(); location.hash = '#/course';
    } catch (ex) {
      const m = ex.message || '';
      err.textContent = /Invalid login/i.test(m) ? 'الإيميل أو كلمة المرور غير صحيحة.' : /already registered/i.test(m) ? 'هذا الإيميل مسجّل من قبل — سجّل دخول.' : /Email not confirmed/i.test(m) ? 'لازم تأكد إيميلك أول من الرابط اللي وصلك.' : /rate limit/i.test(m) ? 'محاولات كثيرة، جرّب بعد شوي.' : 'صار خطأ: ' + m;
      err.classList.add('show');
    } finally { go.disabled = false; }
  };
}

function pageReset() {
  view.innerHTML = `<div class="card auth"><h1>استرجاع كلمة المرور</h1><p class="sub">نرسل لك رابط لتعيين كلمة مرور جديدة.</p>
  <div class="err" id="err"></div><form id="f"><label class="field"><span>الإيميل</span><input name="email" type="email" required dir="ltr"></label><button class="btn" style="width:100%">أرسل الرابط</button></form></div>`;
  document.getElementById('f').onsubmit = async e => {
    e.preventDefault(); const email = new FormData(e.target).get('email');
    const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname + '#/new-password' });
    if (error) { const er = document.getElementById('err'); er.textContent = error.message; er.classList.add('show'); return; }
    view.innerHTML = `<div class="card pending"><div class="big">📩</div><h1>وصلك الرابط</h1><p>شيّك على إيميلك واتبع الرابط.</p></div>`;
  };
}
function pageNewPassword() {
  view.innerHTML = `<div class="card auth"><h1>كلمة مرور جديدة</h1><div class="err" id="err"></div><form id="f"><label class="field"><span>كلمة المرور الجديدة</span><input name="p" type="password" minlength="6" required dir="ltr"></label><button class="btn" style="width:100%">حفظ</button></form></div>`;
  document.getElementById('f').onsubmit = async e => {
    e.preventDefault(); const { error } = await sb.auth.updateUser({ password: new FormData(e.target).get('p') });
    if (error) { const er = document.getElementById('err'); er.textContent = error.message; er.classList.add('show'); return; }
    toast('تم تغيير كلمة المرور'); location.hash = '#/course';
  };
}

function pendingView() {
  const p = state.profile || {};
  const msg = `السلام عليكم، سجّلت في كورس «${C.courseTitle}» وأبي أدفع وأفعّل حسابي.\nالاسم: ${p.full_name || ''}\nالإيميل: ${p.email || state.session.user.email}`;
  view.innerHTML = `
  <div class="card pending">
    <div class="big">⏳</div>
    <h1>حسابك جاهز — باقي التفعيل</h1>
    <p>عشان تفتح لك كل الدروس: تواصل معنا على الواتساب وادفع رسوم الكورس (<b>${AR(C.launchPrice)} ${esc(C.currency)}</b>)، وبنفعّل حسابك في أسرع وقت.</p>
    <a class="btn wa" href="${waLink(msg)}" data-web="${waWeb(msg)}">ادفع وفعّل عبر الواتساب</a>
    <p style="margin-top:18px;font-size:14px">وإلى ذلك الوقت، الدرس الأول مفتوح لك مجاناً.</p>
    <a class="btn ghost" href="#/lesson/1-1">شوف الدرس المجاني</a>
  </div>`;
}

async function myDone() {
  if (!state.session) return new Set();
  const { data } = await sb.from('progress').select('lesson_id');
  return new Set((data || []).map(r => r.lesson_id));
}

async function pageCourse() {
  if (!state.session) return (location.hash = '#/login');
  if (!approved()) return pendingView();
  loading();
  const [ls, done] = await Promise.all([lessons(), myDone()]);
  const pct = ls.length ? Math.round(done.size / ls.length * 100) : 0;
  const next = ls.find(l => !done.has(l.id)) || ls[0];
  view.innerHTML = `
  <div class="dash-head">
    <div><span class="chip ok">حسابك مفعّل</span><h1 style="margin-top:8px">أهلاً ${esc((state.profile.full_name || '').split(' ')[0])} 👋</h1><p style="color:var(--mute)">${esc(C.courseTitle)}</p></div>
    <div class="progress"><div style="display:flex;justify-content:space-between"><small>تقدّمك</small><small>${AR(done.size)} / ${AR(ls.length)} درس</small></div><div class="bar"><b style="width:${pct}%"></b></div>
    ${next ? `<a class="btn" style="margin-top:12px;width:100%" href="#/lesson/${next.id}">${done.size ? 'كمّل من حيث وقفت' : 'ابدأ أول درس'}</a>` : ''}</div>
  </div>
  ${curriculumHTML(ls, { member: true, done })}`;
}

const ICON = { pdf: '📄', zip: '🗜️', link: '🔗', html: '🎮', png: '🖼️', jpg: '🖼️', docx: '📝', txt: '📝' };
async function pageLesson(id) {
  if (!state.session) return (location.hash = '#/login');
  loading();
  const ls = await lessons();
  const l = ls.find(x => x.id === id);
  if (!l) { view.innerHTML = '<div class="card pending"><h1>الدرس غير موجود</h1><a class="btn" href="#/course">رجوع</a></div>'; return; }
  if (!approved() && !l.free_preview) return pendingView();
  const [{ data: m }, done] = await Promise.all([sb.from('lesson_media').select('*').eq('lesson_id', id).maybeSingle(), myDone()]);
  const idx = ls.indexOf(l), prev = ls[idx - 1], next = ls[idx + 1];
  let videoHTML = `<div class="msg">الفيديو قيد الرفع — ارجع له بعد شوي.</div>`;
  if (m && m.video_path) {
    const { data: su } = await sb.storage.from(C.bucket).createSignedUrl(m.video_path, 60 * 60 * 3);
    if (su) videoHTML = `<video controls playsinline preload="metadata" controlsList="nodownload" oncontextmenu="return false" src="${su.signedUrl}"></video>`;
  }
  const atts = (m && m.attachments) || [];
  const attLinks = await Promise.all(atts.map(async a => {
    if (a.url) return { ...a, href: a.url };
    const { data } = await sb.storage.from(C.bucket).createSignedUrl(a.path, 60 * 60 * 3, { download: a.download === false ? false : (a.filename || true) });
    return { ...a, href: data && data.signedUrl };
  }));
  const isDone = done.has(id);
  view.innerHTML = `
  <div class="lesson-layout">
    <div>
      <div class="player">${videoHTML}</div>
      <div class="card lesson-info">
        <div style="display:flex;gap:8px;flex-wrap:wrap"><span class="chip">الوحدة ${AR(l.unit)} · الدرس ${AR(l.ord)}</span>${l.kind === 'تطبيق عملي' ? '<span class="chip">تطبيق عملي</span>' : ''}</div>
        <h1>${esc(l.title)}</h1><p>${esc(l.summary || '')}</p>
        <div class="lesson-actions">
          ${approved() ? `<button class="btn ${isDone ? 'ghost' : ''}" id="done">${isDone ? '✓ أنهيت هذا الدرس' : 'أنهيت الدرس'}</button>` : `<a class="btn wa" href="#/course">فعّل حسابك لباقي الدروس</a>`}
          ${prev ? `<a class="btn ghost" href="#/lesson/${prev.id}">→ السابق</a>` : ''}
          ${next ? `<a class="btn ghost" href="#/lesson/${next.id}">التالي ←</a>` : ''}
        </div>
      </div>
    </div>
    <aside class="side">
      <div class="card" style="margin-bottom:16px">
        <div class="block-t">ملحقات الدرس</div>
        ${attLinks.length ? attLinks.map(a => `<a class="att" ${a.href ? `href="${esc(a.href)}"` : ''} target="_blank" rel="noopener"><span class="ic">${ICON[a.type] || '📎'}</span><span><b>${esc(a.name)}</b><small>${esc(a.note || '')}</small></span></a>`).join('') : '<div class="soon">لا توجد ملحقات لهذا الدرس.</div>'}
      </div>
      <div class="card">
        <div class="block-t">دروس الوحدة ${AR(l.unit)}</div>
        ${ls.filter(x => x.unit === l.unit).map(x => { const open = approved() || x.free_preview; return `<${open ? 'a' : 'div'} class="lesson-row ${x.id === id ? 'cur' : ''} ${done.has(x.id) ? 'done' : ''} ${open ? '' : 'lock'}" ${open ? `href="#/lesson/${x.id}"` : ''}><span class="num">${done.has(x.id) ? '✓' : AR(x.ord)}</span><span class="t"><b>${esc(x.title)}</b></span>${open ? '' : '🔒'}</${open ? 'a' : 'div'}>`; }).join('')}
      </div>
    </aside>
  </div>`;
  const b = document.getElementById('done');
  if (b) b.onclick = async () => {
    if (isDone) { await sb.from('progress').delete().eq('lesson_id', id).eq('user_id', state.session.user.id); }
    else { await sb.from('progress').upsert({ user_id: state.session.user.id, lesson_id: id }); toast('أحسنت! 🎉'); }
    if (!isDone && next) location.hash = '#/lesson/' + next.id; else pageLesson(id);
  };
}

/* ---------- admin ---------- */
async function pageAdmin(tab = 'members') {
  if (!state.profile || !state.profile.is_admin) return (location.hash = '#/');
  view.innerHTML = `
    <div class="dash-head"><div><h1>لوحة الإدارة</h1><p style="color:var(--mute)">فعّل المشتركين بعد الدفع، وارفع فيديوهات الدروس وملحقاتها.</p></div></div>
    <div class="admin-tabs"><a class="btn small ${tab === 'members' ? '' : 'ghost'}" href="#/admin">المشتركين</a><a class="btn small ${tab === 'content' ? '' : 'ghost'}" href="#/admin/content">المحتوى</a></div>
    <div id="admin-body"><div class="loading"><span></span></div></div>`;
  if (tab === 'content') return adminContent();
  const { data: ps, error } = await sb.from('profiles').select('*').order('created_at', { ascending: false });
  const body = document.getElementById('admin-body');
  if (error) { body.innerHTML = `<div class="err show">${esc(error.message)}</div>`; return; }
  const pend = ps.filter(p => !p.approved && !p.is_admin).length;
  body.innerHTML = `
    <div style="display:flex;gap:10px;align-items:center;justify-content:space-between;flex-wrap:wrap;margin-bottom:12px">
      <div><span class="chip warn">بانتظار التفعيل: ${AR(pend)}</span> <span class="chip ok">مفعّل: ${AR(ps.filter(p => p.approved).length)}</span></div>
      <input class="search" id="q" placeholder="ابحث بالاسم أو الإيميل أو الرقم">
    </div>
    <div class="card" style="overflow:auto"><table class="table"><thead><tr><th>المشترك</th><th>الحالة</th><th>تاريخ التسجيل</th><th>إجراء</th></tr></thead><tbody id="rows"></tbody></table></div>`;
  const draw = (q = '') => {
    const rows = ps.filter(p => !q || [p.full_name, p.email, p.phone].join(' ').toLowerCase().includes(q.toLowerCase()));
    document.getElementById('rows').innerHTML = rows.map(p => `
      <tr><td><b>${esc(p.full_name || '—')}</b><br><small dir="ltr" style="color:var(--mute)">${esc(p.email)}${p.phone ? ' · ' + esc(p.phone) : ''}</small></td>
      <td>${p.is_admin ? '<span class="chip">أدمن</span>' : p.approved ? '<span class="chip ok">مفعّل</span>' : '<span class="chip warn">بانتظار الدفع</span>'}</td>
      <td>${new Date(p.created_at).toLocaleDateString('ar-OM')}</td>
      <td><div class="acts">${p.is_admin ? '' : p.approved ? `<button class="btn small danger" data-act="revoke" data-id="${p.id}">إلغاء التفعيل</button>` : `<button class="btn small" data-act="approve" data-id="${p.id}">تفعيل</button>`}
      ${p.phone ? `<a class="btn small wa" href="${waLink('', waNum(p.phone))}" data-web="${waWeb('', waNum(p.phone))}">واتساب</a>` : ''}</div></td></tr>`).join('') || '<tr><td colspan="4" class="soon">ما فيه مشتركين بعد.</td></tr>';
  };
  draw();
  document.getElementById('q').oninput = e => draw(e.target.value);
  body.onclick = async e => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    b.disabled = true;
    const on = b.dataset.act === 'approve';
    const { error } = await sb.from('profiles').update({ approved: on, approved_at: on ? new Date().toISOString() : null }).eq('id', b.dataset.id);
    if (error) { toast('ما تم: ' + error.message); b.disabled = false; return; }
    const p = ps.find(x => x.id === b.dataset.id); p.approved = on; toast(on ? 'تم تفعيل المشترك ✅' : 'تم إلغاء التفعيل'); draw(document.getElementById('q').value);
  };
}

async function adminContent() {
  const body = document.getElementById('admin-body');
  state.lessons = null;
  const ls = await lessons();
  const { data: media } = await sb.from('lesson_media').select('*');
  const M = Object.fromEntries((media || []).map(m => [m.lesson_id, m]));
  body.innerHTML = `<div class="card">${ls.map(l => {
    const m = M[l.id] || {};
    return `<div class="upl" data-id="${l.id}">
      <div><b>${AR(l.unit)}.${AR(l.ord)} — ${esc(l.title)}</b><br><small>${m.video_path ? '🎬 الفيديو مرفوع' : '⚠️ بدون فيديو'} · 📎 ${AR((m.attachments || []).length)} ملحقات ${l.free_preview ? '· مجاني' : ''}</small></div>
      <div class="acts">
        <label class="btn small ghost">رفع فيديو<input type="file" accept="video/mp4" data-kind="video"></label>
        <label class="btn small ghost">إضافة ملحق<input type="file" data-kind="att"></label>
      </div></div>`; }).join('')}</div>
    <p style="color:var(--mute);font-size:13px;margin-top:10px">الحد الأقصى لحجم الملف في الخطة المجانية 50MB.</p>`;
  body.onchange = async e => {
    const inp = e.target; if (inp.type !== 'file' || !inp.files[0]) return;
    const row = inp.closest('.upl'), id = row.dataset.id, f = inp.files[0], l = ls.find(x => x.id === id);
    toast('جاري الرفع…');
    try { await uploadTo(l, f, inp.dataset.kind, f.name); toast('تم الرفع ✅'); adminContent(); }
    catch (ex) { toast('فشل الرفع: ' + ex.message); }
  };
}
async function uploadTo(l, blob, kind, name, meta = {}) {
  const ext = (name.split('.').pop() || 'bin').toLowerCase();
  const folder = l.free_preview ? 'preview' : 'members';
  const path = kind === 'video' ? `${folder}/${l.id}/video-${Date.now()}.mp4` : `${folder}/${l.id}/att-${Date.now()}.${ext}`;
  const { error } = await sb.storage.from(C.bucket).upload(path, blob, { upsert: true, contentType: blob.type || undefined });
  if (error) throw error;
  const { data: cur } = await sb.from('lesson_media').select('*').eq('lesson_id', l.id).maybeSingle();
  const row = cur || { lesson_id: l.id, attachments: [] };
  if (kind === 'video') row.video_path = path;
  else row.attachments = [...(row.attachments || []), { name: meta.name || name.replace(/\.[^.]+$/, ''), note: meta.note || '', type: ext, path, filename: meta.filename || name }];
  const { error: e2 } = await sb.from('lesson_media').upsert(row);
  if (e2) throw e2;
}
// أداة للإدارة: استيراد ملف من رابط (تُستخدم عند تجهيز المحتوى)
window.SAHL_ADMIN = {
  importFromUrl: async (lessonId, url, kind, name, meta) => {
    const l = (await lessons()).find(x => x.id === lessonId);
    const r = await fetch(url); if (!r.ok) throw new Error('fetch ' + r.status);
    const b = await r.blob();
    await uploadTo(l, kind === 'video' ? new Blob([b], { type: 'video/mp4' }) : b, kind, name, meta);
    return 'ok ' + b.size;
  },
  addLink: async (lessonId, name, url, note) => {
    const { data: cur } = await sb.from('lesson_media').select('*').eq('lesson_id', lessonId).maybeSingle();
    const row = cur || { lesson_id: lessonId, attachments: [] };
    row.attachments = [...(row.attachments || []).filter(a => a.url !== url), { name, note: note || '', type: 'html', url }];
    const { error } = await sb.from('lesson_media').upsert(row); if (error) throw error; return 'ok';
  },
  clearAttachments: async (lessonId) => { const { error } = await sb.from('lesson_media').update({ attachments: [] }).eq('lesson_id', lessonId); if (error) throw error; return 'ok'; }
};

/* ---------- router ---------- */
async function route() {
  const h = location.hash.replace(/^#\/?/, '');
  const [a, b] = h.split('/');
  window.scrollTo(0, 0);
  renderNav();
  try {
    if (!a) return pageHome();
    if (a === 'login') return state.session ? (location.hash = '#/course') : authCard('login');
    if (a === 'register') return state.session ? (location.hash = '#/course') : authCard('register');
    if (a === 'reset') return pageReset();
    if (a === 'new-password') return pageNewPassword();
    if (a === 'course') return pageCourse();
    if (a === 'lesson') return pageLesson(b);
    if (a === 'admin') return pageAdmin(b === 'content' ? 'content' : 'members');
    if (a === 'curriculum') { await pageHome(); document.getElementById('curriculum')?.scrollIntoView(); return; }
    return pageHome();
  } catch (ex) {
    view.innerHTML = `<div class="card pending"><div class="big">⚠️</div><h1>صار خطأ</h1><p>${esc(ex.message)}</p><a class="btn" href="#/">الرئيسية</a></div>`;
  }
}
// ملاحظة: لا نستدعي Supabase داخل هذا المستمع مباشرة (يسبب تعليق)، نؤجله خطوة
sb.auth.onAuthStateChange((ev) => {
  if (ev === 'PASSWORD_RECOVERY') { location.hash = '#/new-password'; return; }
  if (ev === 'SIGNED_IN' || ev === 'SIGNED_OUT' || ev === 'USER_UPDATED') {
    setTimeout(async () => { try { await loadSession(); } catch (e) {} renderNav(); }, 0);
  }
});
window.addEventListener('hashchange', () => { if (location.hash === '#curriculum') return; route(); });
document.addEventListener('click', e => { const a = e.target.closest('a[href="#curriculum"]'); if (a) { e.preventDefault(); document.getElementById('curriculum')?.scrollIntoView({ behavior: 'smooth' }); } });
// لا نخلي الصفحة تتعلق: لو تأخرت الجلسة نكمل بدونها
Promise.race([loadSession(), new Promise(r => setTimeout(r, 6000))]).catch(() => {}).finally(route);
})();
