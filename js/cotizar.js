/* ==========================================================
   NEXA — Cotizar Proyecto
   Experiencia cinematográfica (GSAP + canvas particles)
   ========================================================== */
(function () {
    'use strict';

    const root = document.getElementById('cotizar');
    if (!root) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const hasGsap = typeof window.gsap !== 'undefined';

    initParticles();
    if (!reduceMotion) {
        initSphereBreath();
        initParallax();
        initMagneticButton();
    }
    initWhatsAppLink();
    if (hasGsap && !reduceMotion) {
        initIntro();
        initCounters();
    } else {
        revealFallback();
        if (!hasGsap) initCountersFallback();
    }

    /* ---------- Intro GSAP ---------- */
    function initIntro() {
        const items = root.querySelectorAll('[data-cotizar-reveal]');
        const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

        tl.to(items, {
            opacity: 1,
            y: 0,
            duration: 0.9,
            stagger: 0.12
        }, 0.08);

        const nebulaBlue = root.querySelector('.cotizar-nebula--blue');
        const nebulaPink = root.querySelector('.cotizar-nebula--pink');
        if (nebulaBlue && nebulaPink) {
            gsap.to(nebulaBlue, {
                x: 30,
                y: -20,
                duration: 10,
                yoyo: true,
                repeat: -1,
                ease: 'sine.inOut'
            });
            gsap.to(nebulaPink, {
                x: -24,
                y: 18,
                duration: 12,
                yoyo: true,
                repeat: -1,
                ease: 'sine.inOut'
            });
        }
    }

    function revealFallback() {
        root.querySelectorAll('[data-cotizar-reveal]').forEach((el) => {
            el.style.opacity = '1';
            el.style.transform = 'none';
        });
    }

    /* ---------- Sphere breathe / slow rotate ---------- */
    function initSphereBreath() {
        const sphere = document.getElementById('cotizarSphere');
        if (!sphere || !hasGsap) return;

        gsap.to(sphere, {
            scale: 1.035,
            duration: 3.2,
            yoyo: true,
            repeat: -1,
            ease: 'sine.inOut'
        });
    }

    /* ---------- Parallax ---------- */
    function initParallax() {
        const layer = root.querySelector('[data-parallax]');
        if (!layer) return;

        let raf = 0;
        let tx = 0;
        let ty = 0;
        let cx = 0;
        let cy = 0;

        const onMove = (e) => {
            const rect = root.getBoundingClientRect();
            const px = (e.clientX - rect.left) / rect.width - 0.5;
            const py = (e.clientY - rect.top) / rect.height - 0.5;
            const strength = Number(layer.getAttribute('data-parallax')) || 0.08;
            tx = px * 36 * strength * 10;
            ty = py * 28 * strength * 10;
            if (!raf) raf = requestAnimationFrame(tick);
        };

        function tick() {
            cx += (tx - cx) * 0.08;
            cy += (ty - cy) * 0.08;
            layer.style.transform = `translate3d(${cx}px, ${cy}px, 0)`;
            if (Math.abs(tx - cx) > 0.05 || Math.abs(ty - cy) > 0.05) {
                raf = requestAnimationFrame(tick);
            } else {
                raf = 0;
            }
        }

        window.addEventListener('pointermove', onMove, { passive: true });
    }

    /* ---------- Magnetic CTA ---------- */
    function initMagneticButton() {
        const btn = document.getElementById('cotizarWhatsApp');
        if (!btn) return;

        const strength = 14;
        btn.addEventListener('pointermove', (e) => {
            const rect = btn.getBoundingClientRect();
            const x = e.clientX - rect.left - rect.width / 2;
            const y = e.clientY - rect.top - rect.height / 2;
            const dx = (x / rect.width) * strength;
            const dy = (y / rect.height) * strength;
            btn.style.transform = `translate3d(${dx}px, ${dy}px, 0)`;
        });

        btn.addEventListener('pointerleave', () => {
            btn.style.transform = '';
        });
    }

    /* ---------- Counters ---------- */
    function initCounters() {
        const nodes = root.querySelectorAll('[data-count]');
        nodes.forEach((node) => {
            const target = Number(node.getAttribute('data-count')) || 0;
            const obj = { val: 0 };
            gsap.to(obj, {
                val: target,
                duration: 1.8,
                delay: 0.6,
                ease: 'power2.out',
                onUpdate() {
                    node.textContent = String(Math.round(obj.val));
                }
            });
        });
    }

    function initCountersFallback() {
        root.querySelectorAll('[data-count]').forEach((node) => {
            node.textContent = node.getAttribute('data-count') || '0';
        });
    }

    /* ---------- WhatsApp deep link (encoded message) ---------- */
    function initWhatsAppLink() {
        const btn = document.getElementById('cotizarWhatsApp');
        if (!btn) return;
        const message = [
            'Hola NEXA.',
            '',
            'Quiero recibir información sobre sus servicios.',
            'Me gustaría conversar con un asesor.'
        ].join('\n');
        btn.href = `https://wa.me/573208079956?text=${encodeURIComponent(message)}`;
    }

    /* ---------- Particles canvas (60fps-friendly) ---------- */
    function initParticles() {
        const canvas = document.getElementById('cotizarParticles');
        if (!canvas || reduceMotion) return;

        const ctx = canvas.getContext('2d', { alpha: true });
        if (!ctx) return;

        let w = 0;
        let h = 0;
        let particles = [];
        let raf = 0;
        let last = 0;

        function resize() {
            const rect = root.getBoundingClientRect();
            const dpr = Math.min(window.devicePixelRatio || 1, 2);
            w = rect.width;
            h = rect.height;
            canvas.width = Math.floor(w * dpr);
            canvas.height = Math.floor(h * dpr);
            canvas.style.width = `${w}px`;
            canvas.style.height = `${h}px`;
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            seed();
        }

        function seed() {
            const count = Math.min(68, Math.floor((w * h) / 18000));
            particles = Array.from({ length: count }, () => ({
                x: Math.random() * w,
                y: Math.random() * h,
                r: Math.random() * 1.6 + 0.4,
                vx: (Math.random() - 0.5) * 0.22,
                vy: (Math.random() - 0.5) * 0.18 - 0.05,
                hue: Math.random() > 0.45 ? 'blue' : 'pink',
                a: Math.random() * 0.45 + 0.15
            }));
        }

        function frame(ts) {
            if (ts - last < 16) {
                raf = requestAnimationFrame(frame);
                return;
            }
            last = ts;
            ctx.clearRect(0, 0, w, h);

            for (let i = 0; i < particles.length; i += 1) {
                const p = particles[i];
                p.x += p.vx;
                p.y += p.vy;
                if (p.x < -4) p.x = w + 4;
                if (p.x > w + 4) p.x = -4;
                if (p.y < -4) p.y = h + 4;
                if (p.y > h + 4) p.y = -4;

                ctx.beginPath();
                ctx.fillStyle = p.hue === 'blue'
                    ? `rgba(45,140,255,${p.a})`
                    : `rgba(255,45,149,${p.a})`;
                ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
                ctx.fill();
            }

            raf = requestAnimationFrame(frame);
        }

        resize();
        raf = requestAnimationFrame(frame);
        window.addEventListener('resize', resize, { passive: true });

        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                cancelAnimationFrame(raf);
            } else {
                last = 0;
                raf = requestAnimationFrame(frame);
            }
        });
    }
})();
