// Separate a thermostat cycle from concentration and storage hygiene.
// Numerical values below describe a closed, illustrative mass-balance model.
export const safetyHtml = `
<section class="water-safety" aria-labelledby="safety-title">
  <p class="eyebrow">REHEATING / EVAPORATION / STORAGE</p>
  <h2 id="safety-title">水没及时喝完，应该关注什么？</h2>
  <p class="safety-lead">先区分三件事：<strong>热罐反复保温、原有溶质被浓缩、久置后的卫生状况。</strong>加热次数本身不能告诉你水是否安全。</p>
  <div class="safety-grid">
    <article>
      <span class="safety-number">01 / 温控循环</span><h3>热罐会再次加热</h3>
      <p>取水阀关闭时，水仍留在热罐里。温控根据水温接通或断开加热电路；保温循环与持续沸腾是不同的过程。</p>
      <p>反复煮沸的实验发现，水质变化主要受原水成分和蒸发浓缩影响。这不能用来认定任意水源、任意久置条件都安全，也不支持仅凭“又加热了”判断亚硝酸盐超标。</p>
      <button data-goto-phase="5">在上图看保温循环 ↑</button>
      <span class="research-link">Zhai 等，Journal of Water and Health，2020 ↗</span>
    </article>
    <article class="concentration-model">
      <span class="safety-number">02 / 原有成分的浓缩</span><h3>水少了，浓度可能升高</h3>
      <p>水蒸发时，原有的不挥发溶质可能留在水里。EPA 明确指出：煮沸不能去除硝酸盐，蒸发反而可能使其浓度升高。</p>
      <svg class="concentration-svg" viewBox="0 0 300 190" role="img" aria-label="独立的蒸发浓缩模型：两个量杯的溶质总量相同，水量减少后相对浓度升高">
        <text x="67" y="20" text-anchor="middle">起始</text><text x="233" y="20" text-anchor="middle">蒸发后</text>
        <rect x="30" y="40" width="74" height="90" class="model-water"/>
        <rect id="remaining-water" x="196" y="58" width="74" height="72" class="model-water"/>
        <path d="M27 34V133H107V34M193 34V133H273V34" class="model-vessel"/>
        <path d="M30 40H104" class="model-surface"/><path id="remaining-surface" d="M196 58H270" class="model-surface"/>
        ${Array.from({length:12},(_,i)=>`<circle cx="${42+(i%3)*25}" cy="${51+Math.floor(i/3)*22}" r="2.3" class="model-solute"/><circle data-solute="${i}" cx="${208+(i%3)*25}" cy="${67+Math.floor(i/3)*18}" r="2.3" class="model-solute"/>`).join('')}
        <text x="150" y="78" text-anchor="middle" class="evap-label">水蒸发</text>
        <path d="M125 95H175M169 89L175 95L169 101" class="model-arrow" data-free/>
        <text x="67" y="154" text-anchor="middle">水量 100%</text><text id="remaining-label" x="233" y="154" text-anchor="middle">水量 80%</text>
        <text x="150" y="180" text-anchor="middle">两杯溶质总量相同</text>
      </svg>
      <label class="evap-control" for="evap-loss">假设蒸发损失 <output id="evap-percent" for="evap-loss">20%</output></label>
      <input id="evap-loss" type="range" min="0" max="50" step="1" value="20" aria-describedby="evap-assumptions">
      <p class="concentration-result">相对浓度 <strong id="concentration-ratio">1.25×</strong><span> C / C₀ = V₀ / V</span></p>
      <p id="evap-assumptions" class="model-note">教学模型：不补水、不取水；溶质不挥发、不反应、不析出。圆点表示原有溶质的相对总量。实际内胆有补水与取水，不能直接套用此模型；倍数也不是安全阈值。</p>
      <span class="research-link">EPA · 煮沸不能降低硝酸盐含量 ↗</span>
    </article>
    <article>
      <span class="safety-number">03 / 久置与卫生</span><h3>热罐加热覆盖不了整个水路</h3>
      <p>上部储水腔、常温支路和出水嘴都没有经过热罐的加热过程。桶装水饮水机的研究发现，微生物状况与储存、使用和清洁维护条件有关。</p>
      <p>WHO 也说明，在适合的环境中，微生物可将硝酸盐还原为亚硝酸盐。这是有条件的转化机制，不能推断本机已经发生或已超标。</p>
      <button data-goto-phase="6">在上图看卫生关注位置 ↑</button>
      <span class="research-link">Tischner 等，Pathogens，2021 ↗</span>
      <span class="research-link">WHO · 硝酸盐与亚硝酸盐，2022 ↗</span>
    </article>
  </div>
  <div class="safety-actions"><h3>把水源与清洁放在前面</h3><p>使用合格水源，按桶装水标签和饮水机说明管理存放与清洁。长期停用后，恢复使用前按说明换水、清洁水路。怀疑硝酸盐等化学污染时，应确认水质或更换可靠水源，不能靠多煮几次补救。</p><span class="research-link">CDC · 饮水与设备维护建议 ↗</span></div>
  <p class="safety-boundary">本页解释机制与已有研究。没有检测这台 YR-5-A 的水样，不能据此判断其亚硝酸盐、其他化学物或微生物是否超标；也不能给所有桶装水统一规定“几天后有毒”。</p>
</section>`;

export const safetyCSS = `
.water-safety{margin-top:36px;border-top:1px solid var(--anatomy-faint);padding-top:28px}.water-safety>h2{font-size:25px;margin-bottom:12px}.safety-lead{font-size:13px;line-height:1.9;color:var(--anatomy-text);max-width:830px;margin:0 0 25px}.safety-lead strong{font-weight:500}.safety-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:30px}.safety-grid article{border-top:2px solid var(--anatomy-lo);padding-top:17px}.safety-number{font:9px var(--anatomy-mono);color:var(--anatomy-muted)}.safety-grid h3{font-size:16px;line-height:1.6;margin:10px 0}.safety-grid p,.safety-actions p{font-size:11px;line-height:1.9;color:var(--anatomy-text);margin:0 0 13px}.safety-grid button{font-size:11px;line-height:1.6;color:var(--anatomy-strong);background:var(--anatomy-card);border:1px solid var(--anatomy-lo);border-radius:5px;padding:7px 10px;margin:2px 0 8px}.research-link{display:block;font-size:10px;line-height:1.8;color:var(--anatomy-muted);text-decoration:none;margin-top:7px}a.research-link:hover{text-decoration:underline;text-underline-offset:3px}.concentration-svg{display:block;width:100%;height:auto;margin:10px 0}.concentration-svg text{font:10px system-ui;fill:var(--anatomy-text)}.concentration-svg .evap-label{font-size:9px;fill:var(--anatomy-muted)}.model-water{fill:var(--cold-face)}.model-vessel{fill:none;stroke:var(--anatomy-hi);stroke-width:1.5}.model-surface{fill:none;stroke:var(--cold-ink);stroke-width:1}.model-solute{fill:var(--anatomy-strong)}.model-arrow{fill:none;stroke:var(--anatomy-muted);stroke-width:1.2}.evap-control{display:flex;justify-content:space-between;font-size:10px;color:var(--anatomy-text)}#evap-loss{display:block;width:100%;margin:11px 0;accent-color:var(--cold-ink)}.safety-grid .concentration-result{display:flex;align-items:baseline;gap:8px;font-size:10px;margin:0 0 10px}.concentration-result strong{font-size:20px;font-weight:500;color:var(--anatomy-strong)}.concentration-result span{font:9px var(--anatomy-mono);color:var(--anatomy-muted)}.safety-grid .model-note,.safety-boundary{font-size:10px;line-height:1.9;color:var(--anatomy-muted)}.safety-actions{margin-top:27px;padding:18px 20px;background:var(--anatomy-card);border:1px solid var(--anatomy-faint);border-radius:6px}.safety-actions h3{margin:0 0 9px;font-size:13px}.safety-actions p{margin-bottom:0;max-width:970px}.safety-boundary{margin-top:15px}.cycle-controls{margin:18px 0;padding:13px 0;border-top:1px solid var(--anatomy-faint);border-bottom:1px solid var(--anatomy-faint)}.cycle-controls[hidden]{display:none}.cycle-step-list{display:grid;grid-template-columns:1fr 1fr;gap:9px}.cycle-step-list span{font-size:10px;color:var(--anatomy-muted)}.cycle-step-list span[data-active=true]{color:var(--heat-ink);font-weight:600}.cycle-controls button{margin-top:12px;font-size:10px;border:1px solid var(--anatomy-lo);border-radius:4px;background:var(--anatomy-card);padding:6px 9px;color:var(--anatomy-text)}.cycle-controls p{font-size:9px;color:var(--anatomy-muted);line-height:1.8;margin:10px 0 0}.water-stage svg[data-phase='6'] [data-core-part='reservoir.wall'] .iso-edge,.water-stage svg[data-phase='6'] [data-core-part='reservoir.water'] .iso-edge,.water-stage svg[data-phase='6'] [data-core-part='reservoir.lid'] .iso-edge,.water-stage svg[data-phase='6'] [data-core-part='reservoir.bucket-neck'] .iso-edge,.water-stage svg[data-phase='6'] [data-core-part='reservoir.neck-rim'] .iso-edge,.water-stage svg[data-phase='6'] [data-core-part='cold.valve'] .iso-edge,.water-stage svg[data-phase='6'] [data-core-part='cold.nozzle'] .iso-edge,.water-stage svg[data-phase='6'] [data-core-part='hot.nozzle'] .iso-edge,.water-stage svg[data-phase='6'] [data-core-part='cold.mouth'] .iso-edge,.water-stage svg[data-phase='6'] [data-core-part='hot.mouth'] .iso-edge,.water-stage svg[data-phase='6'] [data-core-part^='cold.pipe:'] .tb-edge{stroke:var(--hygiene-ink);stroke-width:1.6}
#hygiene-key[hidden]{display:none}
@media(max-width:800px){.safety-grid{grid-template-columns:1fr;gap:27px}.water-safety>h2{font-size:22px}.safety-lead{font-size:12px}.concentration-svg{max-width:380px;margin:10px auto}.safety-actions{padding:16px}.safety-grid article{padding-top:14px}}
`;

export const safetyLive = `
function updateConcentration(){const loss=Number(document.getElementById('evap-loss').value),fraction=1-loss/100,height=90*fraction,top=130-height;document.getElementById('remaining-water').setAttribute('y',top);document.getElementById('remaining-water').setAttribute('height',height);document.getElementById('remaining-surface').setAttribute('d','M196 '+top+'H270');document.querySelectorAll('[data-solute]').forEach(el=>{const i=+el.dataset.solute;el.setAttribute('cy',top+(Math.floor(i/3)+.5)*height/4)});document.getElementById('evap-percent').textContent=loss+'%';document.getElementById('remaining-label').textContent='水量 '+(100-loss)+'%';document.getElementById('concentration-ratio').textContent=(1/fraction).toFixed(2)+'×'}
document.getElementById('evap-loss').addEventListener('input',updateConcentration);updateConcentration();
document.querySelectorAll('[data-goto-phase]').forEach(button=>button.addEventListener('click',()=>{select(+button.dataset.gotoPhase);document.querySelector('.water-layout').scrollIntoView({block:'start',behavior:still.matches?'auto':'smooth'})}));
document.getElementById('cycle-next').addEventListener('click',()=>{age=((Math.floor(age/2)+1)%4)*2;updateText();draw();run()});
`;
