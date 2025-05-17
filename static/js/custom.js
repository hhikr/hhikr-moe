document.addEventListener("DOMContentLoaded", function () {
  document.querySelectorAll(".mask-container").forEach(el => {
    el.addEventListener("click", function () {
      el.classList.add("revealed");
    });
  });
});
