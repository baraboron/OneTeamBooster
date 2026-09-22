(function(root){
  const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  let api=null,allowed=false,loaded=false,busy=false,page=1,totalPages=1;
  const el=id=>root.document.getElementById(id);
  function formatTime(value){
    const date=new Date(value);
    return Number.isNaN(date.getTime())?'시간 정보 없음':new Intl.DateTimeFormat('ko-KR',{dateStyle:'medium',timeStyle:'short'}).format(date);
  }
  function setUsers(users){
    const select=el('admin-user'),current=select.value;
    select.innerHTML='<option value="">전체 사용자</option>'+users.map(user=>`<option value="${esc(user.USER_ID)}">${esc(user.USER_NM)} · ${esc(user.DEPT_NM||'소속 정보 없음')}</option>`).join('');
    if(users.some(user=>user.USER_ID===current))select.value=current;
  }
  function row(record){
    const selections=[...(record.missions||[]),...(record.boosts||[]),...(record.impacts||[])];
    return `<tr><td><time datetime="${esc(record.time)}">${esc(formatTime(record.time))}</time></td><td><b>${esc(record.from)}</b><small>${esc(record.team||'소속 정보 없음')}</small></td><td><b>${esc(record.recipient)}</b><small>${esc(record.recipientTeam||'소속 정보 없음')}</small></td><td>${esc(record.projectName)}</td><td><div class="admin-tags">${selections.map(value=>`<span>${esc(value)}</span>`).join('')}</div></td><td class="admin-message">${esc(record.message)}</td><td>${record.replied?'<span class="status done">답장 완료</span>':'<span class="status waiting">답장 전</span>'}</td></tr>`;
  }
  function updatePagination(){
    el('admin-page').textContent=`${page} / ${Math.max(1,totalPages)}`;
    el('admin-prev').disabled=busy||page<=1;
    el('admin-next').disabled=busy||page>=totalPages;
  }
  async function load(nextPage=1){
    if(!allowed||busy)return;
    busy=true;page=nextPage;updatePagination();el('admin-result-count').textContent='칭찬 이력을 불러오는 중입니다.';
    try{
      const result=await api.adminRecords({userId:el('admin-user').value,direction:el('admin-direction').value,q:el('admin-query').value.trim(),page});
      if(!allowed)return;
      if(!loaded)setUsers(result.users||[]);
      loaded=true;totalPages=result.totalPages||1;
      el('admin-result-count').textContent=`선택한 조건의 칭찬 ${result.total}건`;
      el('admin-records').innerHTML=result.records?.length?result.records.map(row).join(''):'<tr><td colspan="7" class="empty">선택한 조건에 해당하는 칭찬이 없습니다.</td></tr>';
    }catch(error){
      el('admin-result-count').textContent=error.message||'칭찬 이력을 불러오지 못했습니다.';
      el('admin-records').innerHTML='<tr><td colspan="7" class="empty">다시 조회해 주세요.</td></tr>';
      if(error.status===403)setAccess(false);
    }finally{busy=false;updatePagination();}
  }
  function setAccess(value){
    allowed=value===true;
    const nav=root.document.querySelector('[data-view="admin"]');
    if(nav)nav.hidden=!allowed;
    if(!allowed){
      loaded=false;page=1;totalPages=1;
      el('admin-user').innerHTML='<option value="">전체 사용자</option>';
      el('admin-direction').value='all';el('admin-direction').disabled=true;
      el('admin-query').value='';
      el('admin-result-count').textContent='관리자 권한이 있는 사용자만 조회할 수 있습니다.';
      el('admin-records').innerHTML='<tr><td colspan="7" class="empty">관리자 권한이 없습니다.</td></tr>';
      updatePagination();
    }
  }
  function init(client){
    api=client;
    el('admin-filters').addEventListener('submit',event=>{event.preventDefault();load(1);});
    el('admin-user').addEventListener('change',event=>{el('admin-direction').disabled=!event.target.value;if(!event.target.value)el('admin-direction').value='all';});
    el('admin-prev').addEventListener('click',()=>load(page-1));
    el('admin-next').addEventListener('click',()=>load(page+1));
  }
  root.AdminWorkspace={init,setAccess,isAdmin:()=>allowed,open:()=>load(loaded?page:1)};
})(globalThis);
