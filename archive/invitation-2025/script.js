document.addEventListener('DOMContentLoaded', () => {
    // Smooth scrolling for navigation links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();

            document.querySelector(this.getAttribute('href')).scrollIntoView({
                behavior: 'smooth'
            });
        });
    });

    // Optional: Highlight active navigation link based on scroll position
    const sections = document.querySelectorAll('section[id]');
    window.addEventListener('scroll', () => {
        let current = '';
        sections.forEach(section => {
            const sectionTop = section.offsetTop;
            const sectionHeight = section.clientHeight;
            if (pageYOffset >= sectionTop - sectionHeight / 3) { // Adjust offset as needed
                current = section.getAttribute('id');
            }
        });

        document.querySelectorAll('.nav-links a').forEach(a => {
            a.classList.remove('active');
            if (a.getAttribute('href').includes(current)) {
                a.classList.add('active');
            }
        });
    });

    // Placeholder for Carousel Logic
    // For a real carousel, you would integrate a library like Swiper.js here:
    /*
    const swiper = new Swiper('.swiper-container', {
        loop: true,
        pagination: {
            el: '.swiper-pagination',
            clickable: true,
        },
        navigation: {
            nextEl: '.swiper-button-next',
            prevEl: '.swiper-button-prev',
        },
        autoplay: {
            delay: 5000,
            disableOnInteraction: false,
        },
        effect: 'fade', // cinematic fade effect
        fadeEffect: {
            crossFade: true
        }
    });
    */

    // Simple placeholder for the date display (you'd replace with actual date)
    const weddingDateElement = document.getElementById('wedding-date');
    const actualWeddingDate = new Date('2024-10-26T15:00:00'); // Set your actual wedding date and time
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    weddingDateElement.textContent = `Wedding Date: ${actualWeddingDate.toLocaleDateString('en-US', options)}`;

    // Optional: Countdown Timer (more complex, but here's a start)
    // function updateCountdown() {
    //     const now = new Date().getTime();
    //     const distance = actualWeddingDate - now;

    //     const days = Math.floor(distance / (1000 * 60 * 60 * 24));
    //     const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    //     const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
    //     const seconds = Math.floor((distance % (1000 * 60)) / 1000);

    //     if (distance < 0) {
    //         // document.getElementById("countdown").innerHTML = "WE ARE MARRIED!";
    //         clearInterval(countdownInterval);
    //     } else {
    //         // document.getElementById("countdown").innerHTML = `${days}d ${hours}h ${minutes}m ${seconds}s`;
    //     }
    // }
    // const countdownInterval = setInterval(updateCountdown, 1000);
    // updateCountdown(); // Initial call

    // Simple mobile nav toggle
    const toggle = document.querySelector('.nav-toggle');
    const navLinks = document.querySelector('.nav-links');
    if (!toggle || !navLinks) return;

    toggle.addEventListener('click', () => {
        const isOpen = navLinks.classList.toggle('open');
        toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    });
});