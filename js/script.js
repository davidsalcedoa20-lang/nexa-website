/*=========================================================
                    NEXA VISUALES
                    script.js
=========================================================*/

/*=========================================================
                    DESARROLLO WEB
=========================================================*/

const webData = [

{
    image:"../assets/portafolio/web/Presencia digital.png",

    title:"Sitios Corporativos",

    description:"Desarrollamos sitios web profesionales que fortalecen la presencia digital de tu empresa, generan confianza desde el primer contacto y comunican el valor de tu marca con una experiencia moderna y eficiente.",

    leftTitle:"Construye Confianza",

    leftDescription:"Una presencia digital sólida comienza con una imagen profesional.",

    leftItems:[
        "Diseño moderno y exclusivo",
        "Arquitectura clara de información",
        "Identidad visual consistente"
    ],

    rightTitle:"Alto Rendimiento",

    rightDescription:"Sitios preparados para crecer junto a tu empresa.",

    rightItems:[
        "Optimización SEO",
        "Carga ultrarrápida",
        "Diseño responsive"
    ],

    color:"#8c52ff"
},

{
    image:"../assets/portafolio/web/Conversion.png",

    title:"Landing Pages",

    description:"Creamos páginas enfocadas en una única acción: convertir visitantes en clientes potenciales mediante una estructura estratégica, contenido persuasivo y llamados a la acción efectivos.",

    leftTitle:"Mayor Conversión",

    leftDescription:"Cada elemento tiene un propósito comercial.",

    leftItems:[
        "Llamados a la acción",
        "Formularios optimizados",
        "Experiencia intuitiva"
    ],

    rightTitle:"Resultados Medibles",

    rightDescription:"Diseñadas para potenciar campañas digitales.",

    rightItems:[
        "Captación de clientes",
        "Reservas y cotizaciones",
        "Integración con campañas"
    ],

    color:"#3b82f6"
},

{
    image:"../assets/portafolio/web/Comercio online.png",

    title:"E-commerce",

    description:"Desarrollamos tiendas virtuales optimizadas para vender de forma rápida, segura y sencilla, ofreciendo una experiencia de compra fluida desde cualquier dispositivo.",

    leftTitle:"Experiencia de Compra",

    leftDescription:"Todo pensado para facilitar la venta.",

    leftItems:[
        "Catálogo organizado",
        "Carrito optimizado",
        "Proceso de compra intuitivo"
    ],

    rightTitle:"Escalabilidad",

    rightDescription:"Preparado para crecer con tu negocio.",

    rightItems:[
        "Pagos en línea",
        "Automatización",
        "Gestión de inventario"
    ],

    color:"#10b981"
},

{
    image:"../assets/portafolio/web/Experiencias premium.png",

    title:"Experiencias Digitales",

    description:"Creamos experiencias web de alto impacto combinando diseño, animaciones e interacción para diferenciar tu marca y dejar una impresión memorable en cada visitante.",

    leftTitle:"Impacto Visual",

    leftDescription:"Interfaces que destacan frente a la competencia.",

    leftItems:[
        "Animaciones fluidas",
        "Interacciones avanzadas",
        "Diseño exclusivo"
    ],

    rightTitle:"Innovación",

    rightDescription:"Tecnología al servicio de tu marca.",

    rightItems:[
        "Experiencias inmersivas",
        "Diferenciación",
        "Alto valor percibido"
    ],

    color:"#f59e0b"
}

];


/*=========================================================
              PRODUCCIÓN AUDIOVISUAL
=========================================================*/

const audiovisualData = [

{
    image:"../assets/portafolio/web/laptop1.webp",

    title:"Restaurantes",

    description:"Creamos contenido audiovisual que despierta el apetito, fortalece la identidad de tu restaurante y genera una conexión inmediata con tus clientes a través de imágenes de alto impacto.",

    leftTitle:"Producción Profesional",

    leftDescription:"Cada toma está pensada para resaltar la calidad de tus productos y la experiencia de tu marca.",

    leftItems:[
        "Grabación en alta resolución",
        "Iluminación profesional",
        "Planos cinematográficos"
    ],

    rightTitle:"Contenido que Vende",

    rightDescription:"Videos diseñados para aumentar el alcance, la interacción y las visitas a tu negocio.",

    rightItems:[
        "Reels para redes sociales",
        "Contenido publicitario",
        "Edición dinámica"
    ],

    color:"#ff3b5c"
},

{
    image:"../assets/portafolio/web/laptop1.webp",

    title:"Arquitectura",

    description:"Mostramos cada proyecto resaltando sus espacios, materiales y detalles mediante composiciones visuales que transmiten diseño, amplitud y calidad.",

    leftTitle:"Perspectiva Profesional",

    leftDescription:"Capturamos la esencia de cada espacio desde los mejores ángulos.",

    leftItems:[
        "Interiores y exteriores",
        "Movimientos cinematográficos",
        "Composición profesional"
    ],

    rightTitle:"Presentación Comercial",

    rightDescription:"Material audiovisual pensado para constructoras, arquitectos e inmobiliarias.",

    rightItems:[
        "Videos corporativos",
        "Presentación de proyectos",
        "Contenido para ventas"
    ],

    color:"#4f8cff"
},

{
    image:"../assets/portafolio/web/laptop1.webp",

    title:"Moda y Productos",

    description:"Creamos producciones visuales que destacan la identidad, el estilo y el valor de cada producto para fortalecer el posicionamiento de tu marca.",

    leftTitle:"Imagen de Marca",

    leftDescription:"Contenido que transmite profesionalismo y exclusividad.",

    leftItems:[
        "Fotografía comercial",
        "Video de producto",
        "Contenido para catálogo"
    ],

    rightTitle:"Mayor Impacto",

    rightDescription:"Diseñado para captar la atención desde el primer segundo.",

    rightItems:[
        "Campañas digitales",
        "Contenido para e-commerce",
        "Redes sociales"
    ],

    color:"#8c52ff"
},

{
    image:"../assets/portafolio/web/laptop1.webp",

    title:"Empresas y Eventos",

    description:"Documentamos eventos corporativos y producimos contenido institucional que fortalece la imagen de tu empresa y comunica profesionalismo.",

    leftTitle:"Cobertura Integral",

    leftDescription:"Capturamos los momentos más importantes de cada proyecto.",

    leftItems:[
        "Eventos empresariales",
        "Conferencias",
        "Lanzamientos"
    ],

    rightTitle:"Comunicación Corporativa",

    rightDescription:"Contenido pensado para fortalecer la confianza y el posicionamiento de tu organización.",

    rightItems:[
        "Videos institucionales",
        "Entrevistas",
        "Contenido corporativo"
    ],

    color:"#00c896"
}

];
/*=========================================================
            GALERÍA AUDIOVISUAL
=========================================================*/

/*=========================================================
                VARIABLES DESARROLLO WEB
=========================================================*/

let currentSlide = 0;

const laptop = document.getElementById("webLaptop");

const title = document.getElementById("webTitle");

const description = document.getElementById("webDescription");

const leftTitle = document.getElementById("leftTitle");

const leftDescription = document.getElementById("leftDescription");

const rightTitle = document.getElementById("rightTitle");

const rightDescription = document.getElementById("rightDescription");

const glow = document.querySelector(".web-glow");

const buttons = document.querySelectorAll(".showcase-btn");

const dots = document.querySelectorAll(".dot");

const leftList = document.getElementById("leftList");

const rightList = document.getElementById("rightList");

const leftPanel = document.querySelector(".showcase-left");

const rightPanel = document.querySelector(".showcase-right");

const header = document.querySelector(".showcase-header");
/*=========================================================
            VARIABLES GALERÍA AUDIOVISUAL
=========================================================*/

const galleryMain = document.getElementById("galleryMain");

const gallery1 = document.getElementById("gallery1");

const gallery2 = document.getElementById("gallery2");

const gallery3 = document.getElementById("gallery3");

const gallery4 = document.getElementById("gallery4");

const gallery5 = document.getElementById("gallery5");
/*=========================================================
                    AUTOPLAY
=========================================================*/

let sliderInterval = null;


/*=========================================================
            FUNCIÓN PRINCIPAL DEL SLIDER
=========================================================*/

function updateSlide(index){

    const item = webData[index];

    laptop.classList.remove("laptop-in");

    laptop.classList.add("laptop-out");

    leftPanel.classList.add("web-animate-out");

    rightPanel.classList.add("web-animate-out");

    header.classList.add("web-animate-out");

    setTimeout(()=>{

        laptop.src = item.image;

        title.textContent = item.title;

        description.textContent = item.description;

        leftTitle.textContent = item.leftTitle;

        leftDescription.textContent = item.leftDescription;

        rightTitle.textContent = item.rightTitle;

        rightDescription.textContent = item.rightDescription;

        glow.style.background = item.color;

        glow.style.boxShadow = `0 0 80px ${item.color}`;

        leftList.innerHTML = "";

        item.leftItems.forEach(text=>{

            leftList.innerHTML += `<li>${text}</li>`;

        });

        rightList.innerHTML = "";

        item.rightItems.forEach(text=>{

            rightList.innerHTML += `<li>${text}</li>`;

        });

        buttons.forEach(btn=>btn.classList.remove("active"));

        buttons[index].classList.add("active");

        dots.forEach(dot=>dot.classList.remove("active"));

        dots[index].classList.add("active");

        laptop.classList.remove("laptop-out");

        laptop.classList.add("laptop-in");

        setTimeout(()=>{

            leftPanel.classList.remove("web-animate-out");

        },100);

        setTimeout(()=>{

            rightPanel.classList.remove("web-animate-out");

        },220);

        setTimeout(()=>{

            header.classList.remove("web-animate-out");

        },340);

        currentSlide = index;

    },250);

}
/*=========================================================
                EVENTOS BOTONES
=========================================================*/

buttons.forEach((button,index)=>{

    button.addEventListener("click",()=>{

        updateSlide(index);

        resetAutoPlay();

    });

});


/*=========================================================
                    AUTOPLAY
=========================================================*/

function startAutoPlay(){

    sliderInterval = setInterval(()=>{

        let next = currentSlide + 1;

        if(next >= webData.length){

            next = 0;

        }

        updateSlide(next);

    },10000);

}

function resetAutoPlay(){

    clearInterval(sliderInterval);

    sliderInterval = null;

    startAutoPlay();

}


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
                    PARALLAX
=========================================================*/

const showcase = document.getElementById("showcaseCenter");

if(showcase){

    document.addEventListener("mousemove",(e)=>{

        const x =

        (window.innerWidth/2-e.clientX)/45;

        const y =

        (window.innerHeight/2-e.clientY)/45;

        showcase.style.transform=

        `rotateY(${-x}deg)
         rotateX(${y}deg)`;

    });

}


/*=========================================================
                INICIALIZACIÓN
=========================================================*/

if(laptop){

    updateSlide(0);

    startAutoPlay();

}
/*=========================================================
            PRODUCCIÓN AUDIOVISUAL
=========================================================*/
/*=========================================================
        CARGAR GALERÍA AUDIOVISUAL
=========================================================*/

/*=========================================================
                MODAL VIDEO
=========================================================*/

function openVideo(video){

    console.log(video);

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