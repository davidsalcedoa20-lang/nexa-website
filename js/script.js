/*=========================================================
                    NEXA VISUALES
                    script.js
=========================================================*/

/*=========================================================
                SCROLL REVEAL
=========================================================*/

const revealElements = document.querySelectorAll(".reveal");

const revealObserver = new IntersectionObserver((entries)=>{

    entries.forEach(entry=>{

        if(entry.isIntersecting){

            entry.target.classList.add("active");

        }

    });

},{
    threshold:.2
});

revealElements.forEach(item=>{

    revealObserver.observe(item);

});

/*=========================================================
                MODAL VIDEO
=========================================================*/

function openVideo(video){

    const modal = document.getElementById("videoModal");

    const player = document.getElementById("videoPlayer");

    modal.style.display = "flex";

    player.src = video;

    player.load();

    player.play();

}

function closeVideo(){

    const modal = document.getElementById("videoModal");

    const player = document.getElementById("videoPlayer");

    modal.style.display = "none";

    player.pause();

    player.currentTime = 0;

    player.src = "";

}

/*=========================================================
                MODAL IMAGEN
=========================================================*/

function openImg(src){

    document.getElementById("imgModal").style.display="flex";

    document.getElementById("modalImg").src=src;

}

function closeImg(){

    document.getElementById("imgModal").style.display="none";

}

/*=========================================================
                MENÚ HAMBURGUESA
=========================================================*/

const menuToggle = document.getElementById("menuToggle");

const navLinks = document.getElementById("navLinks");

if(menuToggle && navLinks){

    menuToggle.addEventListener("click",()=>{

        navLinks.classList.toggle("active");

    });

    navLinks.querySelectorAll("a").forEach(link=>{
        link.addEventListener("click",()=>{
            navLinks.classList.remove("active");
        });
    });

}
