(function(){

  // ---- Supabase project config ----
  // Filled in once the Supabase project exists. Both values are meant
  // to be public (the anon key only grants what the RLS policies on
  // the project allow — see schema.sql).
  var SUPABASE_URL = 'https://htlwzwioybybhxgsnlkc.supabase.co';
  var SUPABASE_ANON_KEY = 'sb_publishable_lwbYyNmJ4nO5SEeknz0_zA__bgQtSD4';

  var MEMBERS = [
    {name:'Keane', color:'#4fe6a0'},
    {name:'Callipari', color:'#e8b34d'},
    {name:'Luke', color:'#4fc3f7'},
    {name:'Justis', color:'#ff6b4a'},
    {name:'Simon', color:'#c792ea'},
    {name:'Bike', color:'#f2d94e'}
  ];

  function memberColor(name){
    for(var i=0;i<MEMBERS.length;i++){ if(MEMBERS[i].name===name) return MEMBERS[i].color; }
    return '#8fa89b';
  }
  function initials(name){ return (name||'?').slice(0,2).toUpperCase(); }
  function esc(s){
    return String(s==null?'':s).replace(/[&<>"']/g, function(c){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
    });
  }
  function fmtMoney(n){
    n = Number(n)||0;
    return n.toLocaleString('en-US', {maximumFractionDigits:0});
  }
  function fmtTime(iso){
    try{
      var d = new Date(iso);
      var h = d.getHours(), m = d.getMinutes();
      var ap = h>=12 ? 'PM':'AM';
      h = h%12; if(h===0) h=12;
      var mm = m<10 ? '0'+m : m;
      return (d.getMonth()+1)+'/'+d.getDate()+' '+h+':'+mm+ap;
    }catch(e){ return ''; }
  }
  function newId(){
    return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2,8);
  }

  var db = null;
  var writable = true;
  var ROW_ID = 1;

  var me = null;
  try{ me = localStorage.getItem('fund_member_v1'); }catch(e){}

  var state = {
    fund: { total:0, hysa:0, investments:0, dues:25, ledger:[] },
    meeting: { lastLabel:'', lastNote:'', decided:false, nextLabel:'' },
    dates: [], trips: [], discussion: [],
    market: { asOf:'', indexes:[], headlines:[] }
  };

  function flashSaved(){
    var el = document.getElementById('saveFlash');
    el.classList.add('show');
    clearTimeout(flashSaved._t);
    flashSaved._t = setTimeout(function(){ el.classList.remove('show'); }, 1400);
  }
  function syncedNow(){
    var el = document.getElementById('lastSyncLine');
    var d = new Date();
    var h = d.getHours(), m = d.getMinutes();
    var mm = m<10?'0'+m:m;
    el.textContent = 'UPDATED ' + h + ':' + mm;
  }
  function showOffline(msg){
    var b = document.getElementById('offlineBanner');
    if(msg) b.textContent = msg;
    b.classList.add('show');
  }
  function hideOffline(){
    document.getElementById('offlineBanner').classList.remove('show');
  }

  /* ---------------- render: ticker ---------------- */
  function renderTicker(){
    var leaderTrip = topVoted(state.trips);
    var leaderDate = topVoted(state.dates);
    var items = [
      '<span class="ticker-item">TOTAL FUND <b>$'+fmtMoney(state.fund.total)+'</b></span>',
      '<span class="ticker-item">DUES <b>$'+fmtMoney(state.fund.dues)+'</b>/MO/PARTNER</span>',
      '<span class="ticker-item">NEXT MEETING '+(state.meeting.decided ? '<b>'+esc(state.meeting.nextLabel||'TBD')+'</b>' : (leaderDate ? '<span class="a">VOTING · LEADING '+esc(leaderDate.label)+'</span>' : '<span class="a">VOTING OPEN</span>'))+'</span>',
      '<span class="ticker-item">TRIP '+(leaderTrip ? '<span class="g">'+esc(leaderTrip.destination)+' LEADING</span>' : '<span class="g">NO VOTES YET</span>')+'</span>',
      '<span class="ticker-item">6 PARTNERS ACTIVE</span>'
    ];

    var mkt = state.market;
    if(mkt && mkt.indexes && mkt.indexes.length){
      items.push('<span class="ticker-item">MARKETS AS OF <b>'+esc(mkt.asOf||'')+'</b></span>');
      mkt.indexes.forEach(function(idx){
        var down = idx.dir === 'down';
        items.push('<span class="ticker-item">'+esc(idx.name)+' '+(down?'<span class="a">':'<b>')+esc(idx.value)+' '+esc(idx.change)+(down?'</span>':'</b>')+'</span>');
      });
    }
    if(mkt && mkt.headlines && mkt.headlines.length){
      mkt.headlines.forEach(function(h){
        items.push('<span class="ticker-item"><span class="g">NEWS</span> '+esc(h)+'</span>');
      });
    }

    var html = items.join('');
    document.getElementById('tickerTrack').innerHTML = html + html;
  }

  function topVoted(list){
    if(!list || !list.length) return null;
    var best = null;
    for(var i=0;i<list.length;i++){
      var v = (list[i].votes||[]).length;
      if(!best || v > (best.votes||[]).length) best = list[i];
    }
    if(!best || (best.votes||[]).length===0) return null;
    return best;
  }

  /* ---------------- render: identity bar ---------------- */
  function renderMemberPills(){
    var wrap = document.getElementById('memberPills');
    wrap.innerHTML = MEMBERS.map(function(m){
      var active = m.name===me ? ' active':'';
      return '<button class="pill'+active+'" data-name="'+esc(m.name)+'"><span class="swatch" style="background:'+m.color+'"></span>'+esc(m.name)+'</button>';
    }).join('');
    Array.prototype.forEach.call(wrap.querySelectorAll('.pill'), function(btn){
      btn.addEventListener('click', function(){
        me = btn.getAttribute('data-name');
        try{ localStorage.setItem('fund_member_v1', me); }catch(e){}
        renderMemberPills();
        renderAll();
      });
    });
    var cur = document.getElementById('idbarCurrent');
    cur.innerHTML = me ? ('signed in as <b>'+esc(me)+'</b>') : 'pick your name to vote or post';
  }

  /* ---------------- render: stats ---------------- */
  function renderStats(){
    var leaderTrip = topVoted(state.trips);
    var nextMeet = state.meeting.decided ? (state.meeting.nextLabel||'TBD') : 'Vote open';
    var el = document.getElementById('statsRow');
    el.innerHTML = [
      statTile('Total Fund','$'+fmtMoney(state.fund.total),'','accent'),
      statTile('Next Meeting', nextMeet, state.meeting.decided?'locked':'awaiting votes', state.meeting.decided?'gold':''),
      statTile('Active Partners','6','$'+fmtMoney(state.fund.dues)+'/mo each',''),
      statTile('Trip Frontrunner', leaderTrip ? leaderTrip.destination : '—', leaderTrip ? ((leaderTrip.votes||[]).length+' vote'+((leaderTrip.votes||[]).length===1?'':'s')) : 'no votes yet','gold')
    ].join('');
  }
  function statTile(label,val,sub,cls){
    var sizeStyle = String(val).length > 10 ? ' style="font-size:18px;line-height:1.25;"' : '';
    return '<div class="stat"><div class="stat-label">'+esc(label)+'</div><div class="stat-value'+(cls==='gold'?' gold':'')+'"'+sizeStyle+'>'+esc(val)+'</div>'+(sub?'<div class="stat-sub">'+esc(sub)+'</div>':'')+'</div>';
  }

  /* ---------------- render: meetings ---------------- */
  function renderMeetings(){
    var lockedBox = document.getElementById('nextMeetingLockedBox');
    var voteSection = document.getElementById('meetingVoteSection');
    var flag = document.getElementById('meetingFlag');

    if(state.meeting.decided){
      lockedBox.style.display = '';
      voteSection.style.display = 'none';
      document.getElementById('nextMeetingLockedLabel').textContent = state.meeting.nextLabel || 'TBD';
      flag.textContent = 'Locked';
      flag.className = 'panel-flag locked';
    } else {
      lockedBox.style.display = 'none';
      voteSection.style.display = '';
      flag.textContent = 'Voting Open';
      flag.className = 'panel-flag live';
    }

    var list = document.getElementById('meetingDatesList');
    if(!state.dates.length){
      list.innerHTML = '<div class="empty">No dates proposed yet — add one below.</div>';
    } else {
      var max = Math.max.apply(null, state.dates.map(function(d){return (d.votes||[]).length;}).concat([1]));
      var maxCount = Math.max.apply(null, state.dates.map(function(d){return (d.votes||[]).length;}));
      list.innerHTML = state.dates.map(function(d){
        var votes = d.votes||[];
        var pct = Math.round((votes.length/max)*100);
        var isLead = maxCount>0 && votes.length===maxCount;
        var voted = me && votes.indexOf(me)>-1;
        return '<div class="vote-row">'+
          '<div class="vote-main">'+
            '<div class="vote-label">'+esc(d.label)+'</div>'+
            '<div class="vote-bar-track"><div class="vote-bar-fill'+(isLead&&votes.length>0?' lead':'')+'" style="width:'+pct+'%"></div></div>'+
            (votes.length ? '<div class="avatars">'+votes.map(function(v){return '<span class="avatar" style="background:'+memberColor(v)+'" title="'+esc(v)+'">'+esc(initials(v))+'</span>';}).join('')+'</div>' : '')+
          '</div>'+
          '<div class="vote-count">'+votes.length+'</div>'+
          '<div class="vote-actions">'+
            '<button class="btn small'+(voted?' gold':'')+'" data-vote-date="'+esc(d.id)+'">'+(voted?'Voted ✓':'Vote')+'</button>'+
            '<button class="btn ghost small" data-lock-date="'+esc(d.id)+'">Lock this</button>'+
          '</div>'+
        '</div>';
      }).join('');
    }
  }

  /* ---------------- render: fund ledger ---------------- */
  function renderFund(){
    document.getElementById('fundTotal').value = state.fund.total;
    document.getElementById('fundDues').value = state.fund.dues;
    document.getElementById('fundHysa').value = state.fund.hysa;
    document.getElementById('fundInv').value = state.fund.investments;
    document.getElementById('footDues').textContent = state.fund.dues;

    var tot = Math.max(1, Number(state.fund.hysa||0) + Number(state.fund.investments||0));
    document.getElementById('segHysa').style.width = (Number(state.fund.hysa||0)/tot*100)+'%';
    document.getElementById('segInv').style.width = (Number(state.fund.investments||0)/tot*100)+'%';

    var names = MEMBERS.map(function(m){return m.name;});
    var thead = '<tr><th>Month</th>'+names.map(function(n){return '<th>'+esc(n)+'</th>';}).join('')+'<th>Total</th></tr>';
    var rows = state.fund.ledger.map(function(row,ri){
      var rowTotal = 0;
      var cells = names.map(function(n){
        var v = row.entries && row.entries[n] != null ? row.entries[n] : '';
        rowTotal += Number(v)||0;
        return '<td><input type="number" class="num-in ledger-cell" data-row="'+ri+'" data-name="'+esc(n)+'" value="'+esc(v)+'"></td>';
      }).join('');
      return '<tr><td><input type="text" class="ledger-label" data-row="'+ri+'" value="'+esc(row.label)+'" style="width:84px;background:transparent;border:none;color:var(--text-dim);font-family:var(--mono);font-size:12px;"></td>'+cells+'<td class="num">$'+fmtMoney(rowTotal)+'</td></tr>';
    }).join('');

    var grand = 0;
    state.fund.ledger.forEach(function(row){
      names.forEach(function(n){ grand += Number(row.entries && row.entries[n])||0; });
    });
    var totalRow = '<tr class="total-row"><td>Collected</td>'+names.map(function(){return '<td></td>';}).join('')+'<td>$'+fmtMoney(grand)+'</td></tr>';

    document.getElementById('ledgerTable').innerHTML = thead + rows + totalRow;
  }

  /* ---------------- render: trip ---------------- */
  function renderTrip(){
    var list = document.getElementById('tripOptionsList');
    var flag = document.getElementById('tripFlag');
    if(!state.trips.length){
      list.innerHTML = '<div class="empty">No destinations yet — add the first one.</div>';
      flag.textContent = 'Open';
      flag.className = 'panel-flag live';
    } else {
      flag.textContent = 'Voting';
      flag.className = 'panel-flag live';
      var maxCount = Math.max.apply(null, state.trips.map(function(t){return (t.votes||[]).length;}));
      var maxDen = Math.max(1, maxCount);
      list.innerHTML = state.trips.map(function(t){
        var votes = t.votes||[];
        var pct = Math.round((votes.length/maxDen)*100);
        var isLead = maxCount>0 && votes.length===maxCount;
        var voted = me && votes.indexOf(me)>-1;
        return '<div class="vote-row">'+
          '<div class="vote-main">'+
            '<div class="vote-label">'+esc(t.destination)+'</div>'+
            (t.blurb ? '<div class="vote-meta">'+esc(t.blurb)+'</div>' : '')+
            '<div class="vote-bar-track"><div class="vote-bar-fill'+(isLead&&votes.length>0?' lead':'')+'" style="width:'+pct+'%"></div></div>'+
            (votes.length ? '<div class="avatars">'+votes.map(function(v){return '<span class="avatar" style="background:'+memberColor(v)+'" title="'+esc(v)+'">'+esc(initials(v))+'</span>';}).join('')+'</div>' : '')+
          '</div>'+
          '<div class="vote-count">'+votes.length+'</div>'+
          '<div class="vote-actions">'+
            '<button class="btn small'+(voted?' gold':'')+'" data-vote-trip="'+esc(t.id)+'">'+(voted?'Voted ✓':'Vote')+'</button>'+
          '</div>'+
        '</div>';
      }).join('');
    }

    var d = document.getElementById('discussionList');
    if(!state.discussion.length){
      d.innerHTML = '<div class="empty">No messages yet — say something.</div>';
    } else {
      d.innerHTML = state.discussion.map(function(m){
        return '<div class="msg"><div class="msg-head"><b>'+esc(m.author)+'</b><span>'+fmtTime(m.ts)+'</span></div><div class="msg-text">'+esc(m.text)+'</div></div>';
      }).join('');
      d.scrollTop = d.scrollHeight;
    }
  }

  /* ---------------- render: roster ---------------- */
  function renderRoster(){
    document.getElementById('rosterRow').innerHTML = MEMBERS.map(function(m){
      return '<span class="roster-chip"><span class="swatch" style="background:'+m.color+'"></span>'+esc(m.name)+'</span>';
    }).join('');
  }

  function renderAll(){
    renderTicker();
    renderMemberPills();
    renderStats();
    renderMeetings();
    renderFund();
    renderTrip();
    renderRoster();
  }

  /* ================= PERSISTENCE (Supabase) ================= */

  function requireMe(){
    if(!me){
      alert('Pick your name up top first — that is how your vote gets counted.');
      return false;
    }
    return true;
  }

  /** Push the current `state` to the shared row. Fires immediately —
   * no debounce — so a vote/edit is never lost to someone refreshing
   * the page right after clicking. `change` events here only fire on
   * blur/enter, not per keystroke, so there is no flood risk. */
  var pendingWrites = 0;
  function publishState(){
    renderAll();

    if(!db){
      showOffline('⚠ NOT CONNECTED — changes are only visible in this tab. Refresh the page.');
      return;
    }

    pendingWrites++;
    db.from('fund_state')
      .update({ data: state, updated_at: new Date().toISOString() })
      .eq('id', ROW_ID)
      .select('id')
      .then(function(res){
        pendingWrites = Math.max(0, pendingWrites-1);
        if(res.error){
          showOffline('⚠ COULD NOT SAVE — ' + res.error.message);
        } else if(!res.data || res.data.length === 0){
          // The request succeeded but matched/changed zero rows server-side
          // (a silent-failure mode plain success-checking would miss) —
          // surface it instead of pretending the save worked.
          showOffline('⚠ COULD NOT SAVE — the database did not confirm the write. Refresh and try again.');
        } else {
          writable = true;
          flashSaved();
          syncedNow();
          hideOffline();
        }
      });
  }
  window.addEventListener('beforeunload', function(e){
    if(pendingWrites > 0){
      e.preventDefault();
      e.returnValue = '';
    }
  });

  function wireStaticEvents(){
    document.getElementById('reopenVoteBtn').addEventListener('click', function(){
      state.meeting.decided = false; publishState();
    });
    document.getElementById('addDateBtn').addEventListener('click', function(){
      var input = document.getElementById('newDateLabel');
      var label = input.value.trim();
      if(!label) return;
      if(!requireMe()) return;
      state.dates.push({id:newId(), label:label, votes:[], addedBy:me, createdAt:new Date().toISOString()});
      input.value='';
      publishState();
    });

    ['fundTotal','fundDues','fundHysa','fundInv'].forEach(function(id){
      document.getElementById(id).addEventListener('change', function(e){
        var map = {fundTotal:'total',fundDues:'dues',fundHysa:'hysa',fundInv:'investments'};
        state.fund[map[id]] = Number(e.target.value)||0;
        publishState();
      });
    });

    document.getElementById('addMonthBtn').addEventListener('click', function(){
      var entries = {};
      MEMBERS.forEach(function(m){ entries[m.name] = state.fund.dues; });
      state.fund.ledger.push({label:'New', entries:entries});
      publishState();
    });

    document.getElementById('addTripBtn').addEventListener('click', function(){
      var destInput = document.getElementById('newTripDest');
      var blurbInput = document.getElementById('newTripBlurb');
      var dest = destInput.value.trim();
      if(!dest) return;
      if(!requireMe()) return;
      state.trips.push({id:newId(), destination:dest, blurb:blurbInput.value.trim(), votes:[], addedBy:me, createdAt:new Date().toISOString()});
      destInput.value=''; blurbInput.value='';
      publishState();
    });

    function sendDiscussion(){
      var input = document.getElementById('discussionInput');
      var text = input.value.trim();
      if(!text) return;
      if(!requireMe()) return;
      state.discussion.push({id:newId(), author:me, text:text, ts:new Date().toISOString()});
      if(state.discussion.length > 200) state.discussion = state.discussion.slice(-200);
      input.value='';
      publishState();
    }
    document.getElementById('discussionSendBtn').addEventListener('click', sendDiscussion);
    document.getElementById('discussionInput').addEventListener('keydown', function(e){
      if(e.key==='Enter') sendDiscussion();
    });

    document.body.addEventListener('change', function(e){
      if(e.target.classList && e.target.classList.contains('ledger-cell')){
        var ri = Number(e.target.getAttribute('data-row'));
        var name = e.target.getAttribute('data-name');
        state.fund.ledger[ri].entries[name] = Number(e.target.value)||0;
        publishState();
      }
      if(e.target.classList && e.target.classList.contains('ledger-label')){
        var ri2 = Number(e.target.getAttribute('data-row'));
        state.fund.ledger[ri2].label = e.target.value;
        publishState();
      }
    });

    document.body.addEventListener('click', function(e){
      var voteDateId = e.target.getAttribute && e.target.getAttribute('data-vote-date');
      var lockDateId = e.target.getAttribute && e.target.getAttribute('data-lock-date');
      var voteTripId = e.target.getAttribute && e.target.getAttribute('data-vote-trip');

      if(voteDateId){
        if(!requireMe()) return;
        toggleVote('dates', voteDateId);
      }
      if(lockDateId){
        var d = state.dates.filter(function(x){return x.id===lockDateId;})[0];
        if(d){
          state.meeting.decided = true;
          state.meeting.nextLabel = d.label;
          publishState();
        }
      }
      if(voteTripId){
        if(!requireMe()) return;
        toggleVote('trips', voteTripId);
      }
    });
  }

  function toggleVote(stateKey, id){
    var arr = state[stateKey];
    var item = arr.filter(function(x){return x.id===id;})[0];
    if(!item) return;
    var votes = (item.votes||[]).slice();
    var idx = votes.indexOf(me);
    if(idx>-1) votes.splice(idx,1); else votes.push(me);
    item.votes = votes;
    publishState();
  }

  /* Applies a fresh row from the DB (our own save round-tripping back,
   * or someone else's change arriving over realtime) without stomping
   * on whatever the person is actively typing into a focused field. */
  function applyRemoteState(newState){
    if(!newState) return;
    var active = document.activeElement;
    var typingInField = active && (active.tagName==='INPUT' || active.tagName==='TEXTAREA');
    if(typingInField) return; // next blur/change will publish and reconcile
    state = newState;
    renderAll();
    syncedNow();
  }

  function init(){
    wireStaticEvents();
    renderAll();

    if(typeof window.supabase === 'undefined' || SUPABASE_URL.indexOf('__') === 0){
      showOffline('⚠ NOT CONFIGURED — this page has not been connected to its database yet.');
      return;
    }

    db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    db.from('fund_state').select('data').eq('id', ROW_ID).single().then(function(res){
      if(res.error || !res.data){
        showOffline('⚠ COULD NOT LOAD — ' + (res.error ? res.error.message : 'no data found') + '. Refresh to retry.');
        return;
      }
      state = res.data.data;
      renderAll();
      syncedNow();
      hideOffline();

      db.channel('fund_state_changes')
        .on('postgres_changes', { event:'UPDATE', schema:'public', table:'fund_state', filter:'id=eq.'+ROW_ID }, function(payload){
          applyRemoteState(payload.new && payload.new.data);
        })
        .subscribe();
    });
  }

  init();
})();
