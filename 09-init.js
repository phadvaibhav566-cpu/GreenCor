/* ================================================================
   STARTUP — load any previously saved data and restore the user's
   own session so a page refresh (or opening on another device)
   doesn't lose anything.
   ================================================================ */
(async function gcInit(){
  await loadSharedState();
  renderAuditLog();
  const savedUsername = await loadSession();
  if(savedUsername && DB_USERS[savedUsername]){
    CURRENT_USER = Object.assign({username:savedUsername}, DB_USERS[savedUsername]);
    document.getElementById('loginWrap').style.display='none';
    document.getElementById('app').classList.add('active');
    openDashboardForRole(CURRENT_USER.role);
  }
})();
