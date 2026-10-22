(function(){var s=document.getElementById("boot-splash"),r=document.getElementById("root"),t0=Date.now();
function done(){if(!s)return;s.style.opacity="0";var x=s;s=null;setTimeout(function(){x.remove()},450)}
var iv=setInterval(function(){if(r.querySelector("canvas,img,button")||Date.now()-t0>20000){clearInterval(iv);setTimeout(done,150)}},100)})();
