// Klik teks -> teks berubah jadi animasi "Startled" selama 2 detik, lalu teks balik lagi.
// "Startled" harus ada di ProSprite lain (karakter yang beda dari pemain).
var NAMA_ANIM = "Startled";
var DURASI = 2000; // milidetik

Pro.on("click", function (e) {
  if (e.type !== "text") return;
  var t = e.target;
  if (t.busy) return; // lagi tampil, abaikan klik berikutnya

  var fx = Pro.effect(NAMA_ANIM, t.x, t.y, DURASI, { anchor: "center" });
  if (!fx) {
    Pro.say('Animasi "' + NAMA_ANIM + '" belum ada', 1800);
    return;
  }
  t.busy = true;
  t.visible = false; // sembunyikan teks selama animasi
  setTimeout(function () {
    t.visible = true;
    t.busy = false;
  }, DURASI);
});
