(function(root){
  const messages={
    AUTH_NOT_CONFIGURED:'임직원 검색은 로그인 연결을 기다리고 있습니다.',
    DIRECTORY_NOT_READY:'인사정보를 갱신 중입니다. 잠시 후 다시 검색해 주세요.',
    BACKEND_NOT_CONFIGURED:'임직원 검색 서버에 연결되지 않았습니다.'
  };
  function mount({document:doc=root.document,api=new root.OTBApiClient(),onChange=()=>{}}={}){
    const get=id=>doc.getElementById(id),input=get('employee-query'),department=get('employee-department'),
      results=get('employee-results'),status=get('employee-status'),more=get('employee-more'),retry=get('employee-retry'),selected=get('employee-selected');
    let sequence=0,controller,timer,choice=null,page=0,rows=[],departmentsLoaded=false;
    function clearChoice(){choice=null;selected.textContent='';onChange(null);}
    function cancel(){sequence++;clearTimeout(timer);controller?.abort();}
    function reset(){cancel();clearChoice();input.value='';department.value='';results.replaceChildren();results.setAttribute('aria-busy','false');rows=[];page=0;more.hidden=true;retry.hidden=true;status.textContent='이름·부서·이메일·직책을 2자 이상 입력해 주세요.';}
    function select(employee){
      choice=Object.freeze({...employee});
      selected.textContent=[employee.USER_NM,employee.DEPT_NM,employee.ROLE_NM,employee.USER_EMAIL].filter(Boolean).join(' · ');
      onChange(choice);
      for(const button of results.querySelectorAll('button'))button.setAttribute('aria-pressed',String(button.dataset.userId===employee.USER_ID));
    }
    function render(){
      results.replaceChildren();
      for(const row of rows){
        const item=doc.createElement('li'),button=doc.createElement('button'),name=doc.createElement('b'),detail=doc.createElement('span');
        button.type='button';button.className='employee-result';button.dataset.userId=row.USER_ID;
        button.setAttribute('aria-pressed',String(choice?.USER_ID===row.USER_ID));
        name.textContent=row.USER_NM;
        detail.textContent=[row.DEPT_NM,row.ROLE_NM,row.USER_EMAIL||row.USER_ID].filter(Boolean).join(' · ');
        button.append(name,detail);button.addEventListener('click',()=>select(row));item.append(button);results.append(item);
      }
    }
    async function search(append=false){
      cancel();const current=sequence,query=input.value.trim();
      if(!append){clearChoice();rows=[];page=0;render();}
      more.hidden=true;retry.hidden=true;
      if(query.length<2||query.length>50){status.textContent='검색어를 2~50자로 입력해 주세요.';return;}
      controller=new AbortController();status.textContent='임직원을 검색하고 있습니다.';results.setAttribute('aria-busy','true');
      try{
        const response=await api.employees(query,{page:page+1,department:department.value,signal:controller.signal});
        if(current!==sequence)return;
        if(!Array.isArray(response.data)||!Number.isInteger(response.total)||!Number.isInteger(response.page)||typeof response.hasMore!=='boolean')throw new Error('INVALID_RESPONSE');
        const known=new Set(rows.map(row=>row.USER_ID));
        rows.push(...response.data.filter(row=>row.USER_ID&&row.USER_NM&&!known.has(row.USER_ID)));
        page=response.page;render();more.hidden=!response.hasMore;
        status.textContent=response.total?`검색 결과 ${response.total}명 중 ${rows.length}명 표시`:'검색 결과가 없습니다. 이름이나 부서를 다시 확인해 주세요.';
      }catch(error){
        if(current!==sequence)return;
        status.textContent=messages[error.code]||'임직원 검색에 실패했습니다. 다시 시도해 주세요.';
        retry.hidden=false;retry.onclick=()=>search(append);
      }finally{if(current===sequence)results.setAttribute('aria-busy','false');}
    }
    input.addEventListener('input',()=>{cancel();clearChoice();rows=[];page=0;render();more.hidden=true;retry.hidden=true;results.setAttribute('aria-busy','false');status.textContent='검색어를 확인하고 있습니다.';timer=setTimeout(()=>search(),300);});
    input.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();search();}});
    department.addEventListener('change',()=>search());more.addEventListener('click',()=>search(true));
    async function open(){
      if(departmentsLoaded)return;
      try{const response=await api.departments();
        for(const row of response.data){const option=doc.createElement('option');option.value=row.DEPT_CD;option.textContent=row.DEPT_NM;department.append(option);}
        departmentsLoaded=true;
      }catch{ /* Search presents actionable errors; department filtering stays optional. */ }
    }
    reset();return{open,reset,cancel,getSelected:()=>choice};
  }
  const api={mount};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.EmployeePicker=api;
})(globalThis);
