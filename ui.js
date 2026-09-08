// UI behavior only. Keep points and review policy in their domain modules.
(function () {
  const shell = document.querySelector('.app-shell');
  let activeDialog = null;
  let lastOutsideFocus = null;
  let returnFocus = null;
  const focusable = root => [...root.querySelectorAll('a[href],button:not(:disabled),input:not(:disabled):not([type="hidden"]),textarea:not(:disabled),select:not(:disabled),[tabindex="0"]')].filter(el => el.getClientRects().length);
  document.addEventListener('focusin', event => {
    if (!event.target.closest('.modal-backdrop')) lastOutsideFocus = event.target;
  });
  const syncDialogs = () => {
    const next = document.querySelector('.modal-backdrop.open');
    shell.inert = Boolean(next);
    if (next && next !== activeDialog) {
      returnFocus = lastOutsideFocus;
      activeDialog = next;
      if (!next.contains(document.activeElement)) focusable(next)[0]?.focus();
    } else if (!next && activeDialog) {
      activeDialog = null;
      if (returnFocus?.isConnected && returnFocus.getClientRects().length) returnFocus.focus();
      else document.querySelector('.nav-link.active')?.focus();
    }
  };
  document.querySelectorAll('.modal-backdrop').forEach(modal => {
    new MutationObserver(syncDialogs).observe(modal,{attributes:true,attributeFilter:['class']});
  });
  document.addEventListener('keydown', event => {
    if (!activeDialog) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      closeModal(activeDialog.id);
    }
    if (event.key === 'Tab') {
      const items = focusable(activeDialog), first = items[0], last = items.at(-1);
      if (!first) return;
      if (event.shiftKey && (document.activeElement === first || !activeDialog.contains(document.activeElement))) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault(); first.focus();
      }
    }
  });
  const syncNavigation = () => {
    document.querySelectorAll('.nav-link').forEach(button => {
      if (button.classList.contains('active')) button.setAttribute('aria-current','page');
      else button.removeAttribute('aria-current');
    });
    const current = document.querySelector('.view.active')?.id;
    if (current && location.hash !== '#' + current) history.replaceState(null,'','#' + current);
  };
  document.querySelectorAll('.nav-link').forEach(button => {
    new MutationObserver(syncNavigation).observe(button,{attributes:true,attributeFilter:['class']});
  });
  document.querySelector('.brand').addEventListener('click', event => {
    event.preventDefault(); showView('home'); history.replaceState(null,'','#home');
  });
  window.addEventListener('hashchange', () => {
    const view = location.hash.slice(1);
    if (['home','received','sent','insight'].includes(view)) showView(view);
    syncNavigation();
  });
  syncNavigation();
  syncDialogs();
})();
