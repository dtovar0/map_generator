renderScaleUI();
renderConfigUI();
applyTheme(activeTheme);
const localDraftRestored = restoreLocalDraft();
if (!localDraftRestored) loadDemo();
updateMenuState();
document.getElementById('presentation-date').value = selectedMapDate;
document.getElementById('presentation-refresh').value = String(presentationRefreshMinutes);
updatePresentationViewControls();
updatePaletteHotkeyTitles();
syncTagsToggleBtn();
setupActionDelegation();
// Seed history with the initial state so undo can't go below it
history = [getSnapshot()]; historyIdx = 0; updateUndoBtns();
if (localDraftRestored) {
  setStatus('✓ Borrador local recuperado');
  showToast('Tu avance se restauró automáticamente.', 'success');
}
// Restore the active server map after a refresh. If its selected date no longer
// exists, openServerMap transparently falls back to the latest saved snapshot.
if (currentServerMapId && !localDraftRestored) openServerMap(currentServerMapId, selectedMapDate);
window.addEventListener('beforeunload', () => {
  if (localDraftEnabled) saveLocalDraft();
  if (localDraftTimer) clearTimeout(localDraftTimer);
  if (presentationRefreshTimer) clearInterval(presentationRefreshTimer);
});
