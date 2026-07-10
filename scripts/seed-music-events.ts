import { prisma } from "../src/services/db";

const rawEvents = [
  {
    "dateMonth": 1,
    "dateDay": 8,
    "artistName": "Elvis Presley",
    "eventType": "BIRTH",
    "description": "¡Nace el Rey del Rock! Elvis Presley llega al mundo para revolucionar la música para siempre."
  },
  {
    "dateMonth": 1,
    "dateDay": 8,
    "artistName": "David Bowie",
    "eventType": "BIRTH",
    "description": "¡Nace el camaleón! David Bowie comienza su viaje terrenal, listo para transformar el rock."
  },
  {
    "dateMonth": 2,
    "dateDay": 6,
    "artistName": "Bob Marley",
    "eventType": "BIRTH",
    "description": "¡Nace la leyenda del reggae! Bob Marley llega para esparcir su mensaje de paz y amor universal."
  },
  {
    "dateMonth": 2,
    "dateDay": 20,
    "artistName": "Kurt Cobain",
    "eventType": "BIRTH",
    "description": "¡Nace un ícono del grunge! Kurt Cobain llega para ser la voz de toda una generación."
  },
  {
    "dateMonth": 3,
    "dateDay": 27,
    "artistName": "Mariah Carey",
    "eventType": "BIRTH",
    "description": "¡Nace el Ave Cantora Suprema! Mariah Carey llega con su legendario rango vocal de cinco octavas."
  },
  {
    "dateMonth": 3,
    "dateDay": 30,
    "artistName": "Céline Dion",
    "eventType": "BIRTH",
    "description": "¡Nace una de las voces más prodigiosas del pop! Céline Dion inicia su camino a la grandeza."
  },
  {
    "dateMonth": 4,
    "dateDay": 16,
    "artistName": "Selena Quintanilla",
    "eventType": "BIRTH",
    "description": "¡Nace la Reina del Tex-Mex! Selena Quintanilla llega para brillar y enamorar a multitudes."
  },
  {
    "dateMonth": 4,
    "dateDay": 25,
    "artistName": "Ella Fitzgerald",
    "eventType": "BIRTH",
    "description": "¡Nace la Primera Dama de la Canción! Ella Fitzgerald trae consigo una voz inigualable."
  },
  {
    "dateMonth": 5,
    "dateDay": 3,
    "artistName": "James Brown",
    "eventType": "BIRTH",
    "description": "¡Nace el Padrino del Soul! James Brown llega para enseñarnos lo que es el verdadero ritmo."
  },
  {
    "dateMonth": 5,
    "dateDay": 13,
    "artistName": "Stevie Wonder",
    "eventType": "BIRTH",
    "description": "¡Nace un genio musical! Stevie Wonder llega al mundo para regalarnos su talento infinito."
  },
  {
    "dateMonth": 5,
    "dateDay": 26,
    "artistName": "Lenny Kravitz",
    "eventType": "BIRTH",
    "description": "¡Nace el rockstar! Lenny Kravitz llega para mantener vivo el espíritu del rock and roll."
  },
  {
    "dateMonth": 6,
    "dateDay": 7,
    "artistName": "Prince",
    "eventType": "BIRTH",
    "description": "¡Nace el genio de Minneapolis! Prince llega para redefinir el funk, el rock y el pop."
  },
  {
    "dateMonth": 6,
    "dateDay": 18,
    "artistName": "Paul McCartney",
    "eventType": "BIRTH",
    "description": "¡Nace un Beatle! Paul McCartney inicia una vida de éxitos inmortales y melodías perfectas."
  },
  {
    "dateMonth": 7,
    "dateDay": 26,
    "artistName": "Mick Jagger",
    "eventType": "BIRTH",
    "description": "¡Nace la energía pura! Mick Jagger llega para liderar a los legendarios Rolling Stones."
  },
  {
    "dateMonth": 8,
    "dateDay": 9,
    "artistName": "Whitney Houston",
    "eventType": "BIRTH",
    "description": "¡Nace La Voz! Whitney Houston llega para deslumbrar al mundo con su talento celestial."
  },
  {
    "dateMonth": 8,
    "dateDay": 11,
    "artistName": "Gustavo Cerati",
    "eventType": "BIRTH",
    "description": "¡Nace un genio del rock latino! Gustavo Cerati llega para hacernos vibrar con Soda Stereo."
  },
  {
    "dateMonth": 8,
    "dateDay": 29,
    "artistName": "Michael Jackson",
    "eventType": "BIRTH",
    "description": "¡Nace el Rey del Pop! Michael Jackson llega para cambiar la historia del entretenimiento."
  },
  {
    "dateMonth": 9,
    "dateDay": 4,
    "artistName": "Beyoncé",
    "eventType": "BIRTH",
    "description": "¡Nace Queen B! Beyoncé llega al mundo lista para reinar en la industria musical."
  },
  {
    "dateMonth": 9,
    "dateDay": 5,
    "artistName": "Freddie Mercury",
    "eventType": "BIRTH",
    "description": "¡Nace una leyenda! Freddie Mercury llega para romper barreras y llevar a Queen a la gloria."
  },
  {
    "dateMonth": 10,
    "dateDay": 9,
    "artistName": "John Lennon",
    "eventType": "BIRTH",
    "description": "¡Nace un soñador! John Lennon llega para inspirar al mundo con su música y mensaje de paz."
  },
  {
    "dateMonth": 10,
    "dateDay": 24,
    "artistName": "Drake",
    "eventType": "BIRTH",
    "description": "¡Nace el creador de hits! Drake llega para dominar el hip-hop y las listas de éxitos."
  },
  {
    "dateMonth": 11,
    "dateDay": 26,
    "artistName": "Tina Turner",
    "eventType": "BIRTH",
    "description": "¡Nace la Reina del Rock and Roll! Tina Turner llega con su fuerza y energía arrolladora."
  },
  {
    "dateMonth": 11,
    "dateDay": 27,
    "artistName": "Jimi Hendrix",
    "eventType": "BIRTH",
    "description": "¡Nace el Dios de la Guitarra! Jimi Hendrix llega para revolucionar la forma de tocar rock."
  },
  {
    "dateMonth": 12,
    "dateDay": 13,
    "artistName": "Taylor Swift",
    "eventType": "BIRTH",
    "description": "¡Nace una gigante de la composición! Taylor Swift llega para conquistar corazones con sus letras."
  },
  {
    "dateMonth": 12,
    "dateDay": 24,
    "artistName": "Ricky Martin",
    "eventType": "BIRTH",
    "description": "¡Nace el astro latino! Ricky Martin llega para hacer que el mundo entero baile y celebre."
  },
  {
    "dateMonth": 1,
    "dateDay": 12,
    "artistName": "Zayn Malik",
    "eventType": "BIRTH",
    "description": "¡Nace una estrella! Zayn Malik inicia su camino para conquistar el pop mundial."
  },
  {
    "dateMonth": 2,
    "dateDay": 2,
    "artistName": "Shakira",
    "eventType": "BIRTH",
    "description": "¡Nace la Reina del Pop Latino! Shakira llega para deslumbrar con su voz y movimientos."
  },
  {
    "dateMonth": 2,
    "dateDay": 16,
    "artistName": "The Weeknd",
    "eventType": "BIRTH",
    "description": "¡Nace el genio del R&B moderno! The Weeknd llega para conquistar las luces deslumbrantes."
  },
  {
    "dateMonth": 3,
    "dateDay": 1,
    "artistName": "Justin Bieber",
    "eventType": "BIRTH",
    "description": "¡Nace el fenómeno del pop! Justin Bieber llega para marcar a toda una generación."
  },
  {
    "dateMonth": 3,
    "dateDay": 28,
    "artistName": "Lady Gaga",
    "eventType": "BIRTH",
    "description": "¡Nace Mother Monster! Lady Gaga llega para transformar el pop con su excentricidad y talento."
  },
  {
    "dateMonth": 11,
    "dateDay": 30,
    "artistName": "Michael Jackson",
    "eventType": "ALBUM_RELEASE",
    "description": "¡Lanzamiento histórico! 'Thriller' sale a la luz y se convierte en el disco más vendido."
  },
  {
    "dateMonth": 3,
    "dateDay": 1,
    "artistName": "Pink Floyd",
    "eventType": "ALBUM_RELEASE",
    "description": "¡Una obra maestra! Se lanza 'The Dark Side of the Moon', marcando un antes y después en el rock."
  },
  {
    "dateMonth": 9,
    "dateDay": 24,
    "artistName": "Nirvana",
    "eventType": "ALBUM_RELEASE",
    "description": "¡Explosión grunge! Nirvana lanza 'Nevermind' y cambia la música de los años 90 para siempre."
  },
  {
    "dateMonth": 6,
    "dateDay": 1,
    "artistName": "The Beatles",
    "eventType": "ALBUM_RELEASE",
    "description": "¡Revolución sonora! Lanzamiento del icónico 'Sgt. Pepper’s Lonely Hearts Club Band'."
  },
  {
    "dateMonth": 2,
    "dateDay": 4,
    "artistName": "Fleetwood Mac",
    "eventType": "ALBUM_RELEASE",
    "description": "¡Nace un clásico! Se lanza 'Rumours', un álbum lleno de emociones y éxitos atemporales."
  },
  {
    "dateMonth": 5,
    "dateDay": 16,
    "artistName": "The Beach Boys",
    "eventType": "ALBUM_RELEASE",
    "description": "¡Innovación pop! Lanzamiento de 'Pet Sounds', una influencia eterna en la música."
  },
  {
    "dateMonth": 3,
    "dateDay": 23,
    "artistName": "Elvis Presley",
    "eventType": "ALBUM_RELEASE",
    "description": "¡Debut del Rey! Se lanza el primer álbum homónimo de Elvis Presley, desatando la locura."
  },
  {
    "dateMonth": 11,
    "dateDay": 8,
    "artistName": "Led Zeppelin",
    "eventType": "ALBUM_RELEASE",
    "description": "¡Rock puro! Lanzamiento de 'Led Zeppelin IV', hogar de la legendaria 'Stairway to Heaven'."
  },
  {
    "dateMonth": 12,
    "dateDay": 14,
    "artistName": "The Clash",
    "eventType": "ALBUM_RELEASE",
    "description": "¡Actitud punk! 'London Calling' ve la luz y se convierte en el himno de una generación."
  },
  {
    "dateMonth": 8,
    "dateDay": 25,
    "artistName": "Lauryn Hill",
    "eventType": "ALBUM_RELEASE",
    "description": "¡Magia en R&B! Lanzamiento de 'The Miseducation of Lauryn Hill', una verdadera joya musical."
  },
  {
    "dateMonth": 11,
    "dateDay": 22,
    "artistName": "The Beatles",
    "eventType": "ALBUM_RELEASE",
    "description": "¡Salió el 'White Album'! Esta maravilla doble revoluciona la escena musical con su increíble variedad."
  },
  {
    "dateMonth": 7,
    "dateDay": 25,
    "artistName": "AC/DC",
    "eventType": "ALBUM_RELEASE",
    "description": "¡Puro voltaje! Se publica 'Back in Black', uno de los álbumes más vendidos y potentes del rock."
  },
  {
    "dateMonth": 3,
    "dateDay": 9,
    "artistName": "U2",
    "eventType": "ALBUM_RELEASE",
    "description": "¡Éxito global! 'The Joshua Tree' es lanzado, consolidando a U2 como gigantes del rock."
  },
  {
    "dateMonth": 5,
    "dateDay": 12,
    "artistName": "The Jimi Hendrix Experience",
    "eventType": "ALBUM_RELEASE",
    "description": "¡Magia en la guitarra! 'Are You Experienced' ve la luz, cambiando el rock psicodélico."
  },
  {
    "dateMonth": 6,
    "dateDay": 16,
    "artistName": "David Bowie",
    "eventType": "ALBUM_RELEASE",
    "description": "¡Nace Ziggy! Lanzamiento del épico 'The Rise and Fall of Ziggy Stardust and the Spiders from Mars'."
  },
  {
    "dateMonth": 8,
    "dateDay": 12,
    "artistName": "Metallica",
    "eventType": "ALBUM_RELEASE",
    "description": "¡Metal para las masas! Lanzamiento del famoso 'Black Album' de Metallica, un éxito rotundo."
  },
  {
    "dateMonth": 1,
    "dateDay": 23,
    "artistName": "David Bowie",
    "eventType": "ALBUM_RELEASE",
    "description": "¡Regreso glorioso! Lanzamiento de 'Station to Station', demostrando la genialidad de Bowie."
  },
  {
    "dateMonth": 11,
    "dateDay": 9,
    "artistName": "Wu-Tang Clan",
    "eventType": "ALBUM_RELEASE",
    "description": "¡Historia del rap! Lanzamiento de 'Enter the Wu-Tang (36 Chambers)', revolucionando el hip-hop."
  },
  {
    "dateMonth": 9,
    "dateDay": 28,
    "artistName": "Stevie Wonder",
    "eventType": "ALBUM_RELEASE",
    "description": "¡Obra maestra total! 'Songs in the Key of Life' es lanzado, un regalo eterno para el soul."
  },
  {
    "dateMonth": 4,
    "dateDay": 19,
    "artistName": "Nas",
    "eventType": "ALBUM_RELEASE",
    "description": "¡Un antes y un después! Lanzamiento de 'Illmatic', la biblia del rap y el hip-hop clásico."
  },
  {
    "dateMonth": 5,
    "dateDay": 23,
    "artistName": "Eminem",
    "eventType": "ALBUM_RELEASE",
    "description": "¡Impacto mundial! Lanzamiento del icónico 'The Marshall Mathers LP', un hito en el rap."
  },
  {
    "dateMonth": 3,
    "dateDay": 21,
    "artistName": "Madonna",
    "eventType": "ALBUM_RELEASE",
    "description": "¡La Reina del Pop ataca! Lanzamiento de 'Like a Prayer', marcando la cultura pop global."
  },
  {
    "dateMonth": 1,
    "dateDay": 20,
    "artistName": "Daft Punk",
    "eventType": "ALBUM_RELEASE",
    "description": "¡Revolución electrónica! 'Homework' es lanzado, cambiando la música dance para siempre."
  },
  {
    "dateMonth": 6,
    "dateDay": 25,
    "artistName": "Prince",
    "eventType": "ALBUM_RELEASE",
    "description": "¡Pura leyenda! 'Purple Rain' se estrena como álbum y banda sonora, desatando la locura mundial."
  },
  {
    "dateMonth": 4,
    "dateDay": 23,
    "artistName": "The Rolling Stones",
    "eventType": "ALBUM_RELEASE",
    "description": "¡Obra cumbre! Se lanza 'Sticky Fingers', un disco brillante y provocador de los Stones."
  },
  {
    "dateMonth": 1,
    "dateDay": 24,
    "artistName": "Adele",
    "eventType": "ALBUM_RELEASE",
    "description": "¡Fenómeno de ventas! El álbum '21' ve la luz, conmoviendo al planeta entero con su deslumbrante soul."
  },
  {
    "dateMonth": 10,
    "dateDay": 27,
    "artistName": "Amy Winehouse",
    "eventType": "ALBUM_RELEASE",
    "description": "¡Alma desbordante! Se lanza 'Back to Black', una joya inigualable que redefine el neo-soul para siempre."
  },
  {
    "dateMonth": 10,
    "dateDay": 27,
    "artistName": "Taylor Swift",
    "eventType": "ALBUM_RELEASE",
    "description": "¡Hito pop! Se lanza '1989', catapultando a Taylor a la dominación total del mundo musical."
  },
  {
    "dateMonth": 4,
    "dateDay": 23,
    "artistName": "Beyoncé",
    "eventType": "ALBUM_RELEASE",
    "description": "¡Sorpresa visual! 'Lemonade' ve la luz, redefiniendo el formato de álbum moderno."
  },
  {
    "dateMonth": 11,
    "dateDay": 21,
    "artistName": "Queen",
    "eventType": "ALBUM_RELEASE",
    "description": "¡Rock sinfónico glorioso! 'A Night at the Opera' es publicado, conteniendo 'Bohemian Rhapsody'."
  },
  {
    "dateMonth": 7,
    "dateDay": 13,
    "artistName": "Queen",
    "eventType": "MILESTONE",
    "description": "¡Día histórico! Live Aid recauda fondos con conciertos masivos simultáneos en Londres y Filadelfia."
  },
  {
    "dateMonth": 8,
    "dateDay": 15,
    "artistName": "Jimi Hendrix",
    "eventType": "MILESTONE",
    "description": "¡Amor y paz! Arranca el festival de Woodstock en 1969, definiendo a la generación hippie."
  },
  {
    "dateMonth": 1,
    "dateDay": 30,
    "artistName": "The Beatles",
    "eventType": "MILESTONE",
    "description": "¡El último concierto! The Beatles tocan en la azotea de Apple Corps en Londres."
  },
  {
    "dateMonth": 2,
    "dateDay": 9,
    "artistName": "The Beatles",
    "eventType": "MILESTONE",
    "description": "¡La invasión británica! The Beatles deslumbran a Norteamérica en el Ed Sullivan Show."
  },
  {
    "dateMonth": 10,
    "dateDay": 31,
    "artistName": "Queen",
    "eventType": "MILESTONE",
    "description": "¡Bohemian Rhapsody! Se lanza este épico sencillo, cambiando la historia del rock y del videoclip."
  },
  {
    "dateMonth": 8,
    "dateDay": 1,
    "artistName": "MTV",
    "eventType": "MILESTONE",
    "description": "¡Video Killed the Radio Star! MTV comienza sus transmisiones, revolucionando la cultura musical."
  },
  {
    "dateMonth": 1,
    "dateDay": 14,
    "artistName": "Elvis Presley",
    "eventType": "MILESTONE",
    "description": "¡Concierto satelital! Elvis deslumbra con 'Aloha from Hawaii', el primer show transmitido vía satélite."
  },
  {
    "dateMonth": 11,
    "dateDay": 18,
    "artistName": "Nirvana",
    "eventType": "MILESTONE",
    "description": "¡Momento íntimo y legendario! Nirvana graba su famoso 'MTV Unplugged in New York'."
  },
  {
    "dateMonth": 3,
    "dateDay": 25,
    "artistName": "Michael Jackson",
    "eventType": "MILESTONE",
    "description": "¡El Moonwalk! Michael Jackson sorprende al mundo con su icónico paso de baile durante 'Motown 25'."
  },
  {
    "dateMonth": 4,
    "dateDay": 20,
    "artistName": "Queen",
    "eventType": "MILESTONE",
    "description": "¡Tributo a la leyenda! El Concierto Homenaje a Freddie Mercury emociona al Estadio de Wembley."
  },
  {
    "dateMonth": 1,
    "dateDay": 3,
    "artistName": "Aretha Franklin",
    "eventType": "MILESTONE",
    "description": "¡Triunfo histórico! Aretha Franklin se consagra como la primera mujer en el Salón de la Fama del Rock."
  },
  {
    "dateMonth": 7,
    "dateDay": 12,
    "artistName": "The Rolling Stones",
    "eventType": "MILESTONE",
    "description": "¡El primer show! Los Stones tocan en vivo por primera vez en el Marquee Club de Londres, iniciando la leyenda."
  },
  {
    "dateMonth": 10,
    "dateDay": 9,
    "artistName": "Coachella",
    "eventType": "MILESTONE",
    "description": "¡Nace un ícono! El Festival de Música y Artes de Coachella inaugura sus escenarios en el desierto."
  },
  {
    "dateMonth": 9,
    "dateDay": 19,
    "artistName": "Simon & Garfunkel",
    "eventType": "MILESTONE",
    "description": "¡Cita en el parque! Más de 500,000 personas asisten al concierto gratuito en Central Park."
  },
  {
    "dateMonth": 9,
    "dateDay": 6,
    "artistName": "Jean-Michel Jarre",
    "eventType": "MILESTONE",
    "description": "¡Récord mundial! Jean-Michel Jarre fascina a más de tres millones de personas en su show de Moscú."
  },
  {
    "dateMonth": 2,
    "dateDay": 1,
    "artistName": "Frank Sinatra",
    "eventType": "MILESTONE",
    "description": "¡Magia en Las Vegas! Frank Sinatra graba su deslumbrante disco en vivo 'Sinatra at the Sands'."
  },
  {
    "dateMonth": 2,
    "dateDay": 4,
    "artistName": "Prince",
    "eventType": "MILESTONE",
    "description": "¡Un show perfecto! Prince bajo la lluvia nos regala el mejor Espectáculo de Medio Tiempo de la historia."
  },
  {
    "dateMonth": 1,
    "dateDay": 28,
    "artistName": "Michael Jackson",
    "eventType": "MILESTONE",
    "description": "¡Estrellas unidas! Se graba 'We Are the World', uniendo a las voces más grandes de la época."
  },
  {
    "dateMonth": 10,
    "dateDay": 5,
    "artistName": "The Beatles",
    "eventType": "MILESTONE",
    "description": "¡El inicio! Lanzamiento de 'Love Me Do', el primer sencillo de The Beatles en el Reino Unido."
  },
  {
    "dateMonth": 6,
    "dateDay": 14,
    "artistName": "Daft Punk",
    "eventType": "MILESTONE",
    "description": "¡Una pirámide de luz! Daft Punk deslumbra París con uno de los mejores conciertos de electrónica jamás vistos."
  },
  {
    "dateMonth": 8,
    "dateDay": 4,
    "artistName": "Pink Floyd",
    "eventType": "MILESTONE",
    "description": "¡El muro cobra vida! Comienzan los legendarios y teatrales conciertos de 'The Wall' en Londres."
  },
  {
    "dateMonth": 2,
    "dateDay": 2,
    "artistName": "Shakira",
    "eventType": "MILESTONE",
    "description": "¡Fiesta global! El Medio Tiempo del Super Bowl brilla con la increíble energía y talento latino."
  },
  {
    "dateMonth": 11,
    "dateDay": 15,
    "artistName": "Coldplay",
    "eventType": "MILESTONE",
    "description": "¡Magia en vivo! Coldplay culmina su deslumbrante gira multicolor llenando de luz y música el estadio."
  },
  {
    "dateMonth": 2,
    "dateDay": 18,
    "artistName": "The Rolling Stones",
    "eventType": "MILESTONE",
    "description": "¡Rock en la playa! Los Stones reúnen a más de un millón de fans en un épico show en Copacabana."
  },
  {
    "dateMonth": 8,
    "dateDay": 28,
    "artistName": "Bob Dylan",
    "eventType": "MILESTONE",
    "description": "¡Concierto con mensaje! Dylan canta en la Marcha sobre Washington frente a Martin Luther King Jr."
  },
  {
    "dateMonth": 4,
    "dateDay": 30,
    "artistName": "Miles Davis",
    "eventType": "GENRE_DAY",
    "description": "¡Día Internacional del Jazz! El mundo entero rinde homenaje al poder de este género para unir culturas."
  },
  {
    "dateMonth": 7,
    "dateDay": 13,
    "artistName": "Queen",
    "eventType": "GENRE_DAY",
    "description": "¡Día Mundial del Rock! Festejamos la música que transformó la rebeldía en arte, pasión y energía pura."
  },
  {
    "dateMonth": 10,
    "dateDay": 1,
    "artistName": "Beethoven",
    "eventType": "GENRE_DAY",
    "description": "¡Día Internacional de la Música! Una jornada hermosa dedicada a festejar el arte que nos llena el alma."
  },
  {
    "dateMonth": 6,
    "dateDay": 21,
    "artistName": "The Beatles",
    "eventType": "GENRE_DAY",
    "description": "¡Fiesta de la Música! Las calles se llenan de melodías vibrantes para dar la bienvenida al verano."
  },
  {
    "dateMonth": 11,
    "dateDay": 22,
    "artistName": "Mozart",
    "eventType": "GENRE_DAY",
    "description": "¡Día de Santa Cecilia! Celebramos con entusiasmo a la patrona de la música y a los músicos del mundo."
  },
  {
    "dateMonth": 8,
    "dateDay": 11,
    "artistName": "Tupac",
    "eventType": "GENRE_DAY",
    "description": "¡Nace un movimiento! Celebramos el Día del Hip-Hop, recordando aquella histórica fiesta en el Bronx."
  },
  {
    "dateMonth": 12,
    "dateDay": 11,
    "artistName": "Carlos Gardel",
    "eventType": "GENRE_DAY",
    "description": "¡Día Nacional del Tango! Festejamos con orgullo la pasión y la melancolía de esta hermosa tradición."
  },
  {
    "dateMonth": 1,
    "dateDay": 16,
    "artistName": "The Beatles",
    "eventType": "GENRE_DAY",
    "description": "¡Día de The Beatles! El mundo se une para aplaudir y recordar a la banda más influyente de la historia."
  },
  {
    "dateMonth": 3,
    "dateDay": 9,
    "artistName": "Daft Punk",
    "eventType": "GENRE_DAY",
    "description": "¡Día Mundial del DJ! Una celebración por todo lo alto a los genios que nos hacen bailar sin parar."
  },
  {
    "dateMonth": 5,
    "dateDay": 4,
    "artistName": "John Williams",
    "eventType": "MILESTONE",
    "description": "¡Música de galaxias! Celebramos las épicas e inolvidables composiciones orquestales de Star Wars."
  },
  {
    "dateMonth": 2,
    "dateDay": 21,
    "artistName": "Nina Simone",
    "eventType": "BIRTH",
    "description": "¡Nace la Alta Sacerdotisa del Soul! Nina Simone llega para deslumbrar con su arte inigualable."
  },
  {
    "dateMonth": 4,
    "dateDay": 14,
    "artistName": "Bad Bunny",
    "eventType": "MILESTONE",
    "description": "¡Hito latino mundial! Bad Bunny se corona como el primer hispanohablante en encabezar Coachella."
  },
  {
    "dateMonth": 3,
    "dateDay": 12,
    "artistName": "Daft Punk",
    "eventType": "ALBUM_RELEASE",
    "description": "¡Fiesta intergaláctica! 'Discovery' se publica para regalarnos himnos inmortales del french touch."
  },
  {
    "dateMonth": 10,
    "dateDay": 10,
    "artistName": "Björk",
    "eventType": "ALBUM_RELEASE",
    "description": "¡Innovación total! El universo musical de Björk se expande con 'Biophilia', el revolucionario álbum app."
  },
  {
    "dateMonth": 8,
    "dateDay": 9,
    "artistName": "Queen",
    "eventType": "MILESTONE",
    "description": "¡Gloria absoluta! Queen conquista a más de 120,000 espectadores en su épico último show en Knebworth."
  }
];

async function main() {
  console.log(`Starting to seed ${rawEvents.length} music events...`);
  
  for (const event of rawEvents) {
    try {
      console.log(`Fetching Deezer ID for ${event.artistName}...`);
      const response = await fetch(`https://api.deezer.com/search/artist?q=${encodeURIComponent(event.artistName)}`);
      
      if (!response.ok) {
        throw new Error(`Deezer API returned status ${response.status}`);
      }
      
      const data = await response.json();
      
      let artistId = "0"; // Default
      if (data.data && data.data.length > 0) {
        artistId = data.data[0].id.toString();
      } else {
        console.warn(`No artist found for ${event.artistName}. Skipping...`);
        continue;
      }

      // Check if event already exists
      const existing = await prisma.musicEvent.findFirst({
        where: {
          dateMonth: event.dateMonth,
          dateDay: event.dateDay,
          artistId: artistId,
        }
      });

      if (!existing) {
        await prisma.musicEvent.create({
          data: {
            dateMonth: event.dateMonth,
            dateDay: event.dateDay,
            artistName: event.artistName, // using sanitized name from our own array
            artistId: artistId,
            eventType: event.eventType,
            description: event.description,
          },
        });
        console.log(`✅ Seeded: ${event.artistName} - ${event.description.substring(0, 20)}...`);
      } else {
        console.log(`⏭️ Skipped (Already exists): ${event.artistName}`);
      }
      
    } catch (error) {
      console.error(`❌ Error processing ${event.artistName}:`, error);
    }
    
    // SECURITY COMPLIANCE (STRIDE - DoS Mitigation): Wait 300ms between requests
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  
  console.log("Seeding complete!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
