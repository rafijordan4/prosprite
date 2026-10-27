// HERO - tambahan JS: layar menggelap saat malam + tombol keyboard K untuk ganti ukuran.
// Jam dibaca dari teks jam yang dibuat hero.cd (ui.teks "jam").
(function () {
  var tint = document.createElement("div");
  tint.className = "hero-tint";
  Pro.ui.insertBefore(tint, Pro.ui.firstChild);

  function gelap(jam) {
    // 0 = terang, 1 = gelap penuh. Malam 20:00-04:00 paling gelap.
    if (jam >= 20 || jam < 4) return 1;
    if (jam >= 18) return (jam - 18) / 2;     // senja memudar
    if (jam < 6) return (6 - jam) / 2;         // subuh mulai terang
    if (jam >= 16.5) return (jam - 16.5) / 4;  // sore sedikit redup
    return 0;
  }

  Pro.on("update", function () {
    var hs = Pro.ui.parentNode.querySelectorAll(".cm-hud");
    for (var i = 0; i < hs.length; i++) {
      var m = /(\d\d):(\d\d)/.exec(hs[i].textContent);
      if (m) {
        hs[i].classList.add("hero-jam");
        var jam = +m[1] + (+m[2]) / 60;
        tint.style.opacity = (gelap(jam) * 0.55).toFixed(3);
        break;
      }
    }
  });

  Pro.listen(window, "keydown", function (e) {
    if (e.key === "k" || e.key === "K") {
      var b = Pro.ui.parentNode.querySelector(".cm-btn");
      if (b) b.click();
    }
  });
})();
