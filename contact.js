const contactForm = document.querySelector("#contact-form");

if (contactForm) {
  contactForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const email = contactForm.elements.email.value.trim();
    const message = contactForm.elements.message.value.trim();
    const subject = encodeURIComponent(`Portfolio message from ${email}`);
    const body = encodeURIComponent(`From: ${email}\n\n${message}`);

    window.location.href =
      `mailto:tarikfilipovic2027@u.northwestern.edu?subject=${subject}&body=${body}`;
  });
}
