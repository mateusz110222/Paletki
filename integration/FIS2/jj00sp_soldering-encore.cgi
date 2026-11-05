#!/fis/mantis/common/apps/tcltk/bin/tclsh

################################################################################
#
# @(#) Description: This utility is normally called from a web browser.
# @(#)              This application is designed for ovens
# @(#)
# @(#) Usage: SOLDERING
# @(#)
#
#      Revisions: initial release n/a jj00sp
#
################################################################################

source [file join /fis mantis common config system system.cfg]
source [file join /fis mantis custom config cgi SolderCheck solderCheck.cfg]

Lib::CGILanguage

set this $env(SCRIPT_NAME)
set pathlist [split $this "/"]
set filename [lindex $pathlist [expr [llength $pathlist]- 1] ]
set baseName "jj00sp_soldering"
set param(errorfile)  [file join $_sysvar(LOGDIR) $baseName.log]
set param(debug)      [file join $_sysvar(LOGDIR) $baseName.log]
set param(datafile)   [file join $_sysvar(LOGDIR) $baseName.dat]
set param(cfgfile)    [file join $_sysvar(CSTCFGCGIDIR) $baseName.cfg]
set param(IP) $env(REMOTE_ADDR)

puts "Content-Type: text/html; charset=UTF-8\n"

set sharedHead {
    <meta charset='UTF-8'>
    <meta name='viewport' content='width=device-width, initial-scale=1.0'>
    <link href='https://cdnjs.cloudflare.com/ajax/libs/tailwindcss/2.0.2/tailwind.min.css' rel='stylesheet'>
    <script src='https://cdn.tailwindcss.com'></script>
    <link href='https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Rajdhani:wght@500;600;700&display=swap' rel='stylesheet'>
    <script>tailwind.config = { darkMode: 'class' }</script>
	<style>
        body { font-family: 'Rajdhani', sans-serif; }
        .mono { font-family: 'Share Tech Mono', monospace; }
        .soldering-screen { height:100vh; height:100dvh; display:flex; flex-direction:column; }
        .soldering-screen > header { flex-shrink:0; }
        .soldering-screen > main { flex:1; min-height:0; }
        #formBox { min-height:0; overflow:auto; }
        #formBox > * { flex-shrink:0; }
        .soldering-screen > main > section:not(#formBox) { flex-shrink:0; }
        #messagebox { max-height:35vh; max-height:35dvh; overflow:auto; overflow-wrap:anywhere; }
        @keyframes flicker { 0%,100%{opacity:1} 92%{opacity:1} 93%{opacity:.7} 94%{opacity:1} 96%{opacity:.85} 97%{opacity:1} }
        .flicker { animation: flicker 5s infinite; }
        @keyframes glow-pulse { 0%,100%{text-shadow:0 0 16px rgba(251,191,36,.5)} 50%{text-shadow:0 0 28px rgba(251,191,36,.9),0 0 48px rgba(251,191,36,.35)} }
        .glow { animation: glow-pulse 2.5s ease-in-out infinite; }
        @keyframes countdown { from{stroke-dashoffset:0} to{stroke-dashoffset:126} }
        .countdown-ring { stroke-dasharray:126; stroke-dashoffset:0; animation:countdown 15s linear forwards; }
        @keyframes overlayIn { from{opacity:0;transform:scale(.92) translateY(14px)} to{opacity:1;transform:scale(1) translateY(0)} }
        .overlay-in { animation:overlayIn .35s cubic-bezier(.34,1.56,.64,1); }
    </style>
    <script>
        (function(){
            const t = localStorage.getItem('fis-theme') || 'dark';
            document.documentElement.classList.toggle('dark', t !== 'light');
        })();
        function toggleTheme(){
            const dark = document.documentElement.classList.toggle('dark');
            localStorage.setItem('fis-theme', dark ? 'dark' : 'light');
            const cb = document.getElementById('themeToggle');
            syncThumb();
        }
        function syncThumb(){
            const dark = document.documentElement.classList.contains('dark');
            const thumb = document.getElementById('toggleThumb');
            thumb.style.transform = dark ? 'translateX(0)' : 'translateX(24px)';
            thumb.style.background = dark
                ? 'linear-gradient(135deg,#fbbf24,#d97706)'
                : 'linear-gradient(135deg,#93c5fd,#3b82f6)';
            thumb.textContent = dark ? '\u2600' : '\u263e';
        }
        window.addEventListener('DOMContentLoaded', function(){
            const dark = document.documentElement.classList.contains('dark');
            const cb = document.getElementById('themeToggle');
            if (cb) cb.checked = !dark;
            syncThumb();
        });
    </script>
}

set themeToggle {
    <label class='relative w-12 h-6 cursor-pointer flex-shrink-0' title='Toggle dark / light mode'>
        <input type='checkbox' id='themeToggle' class='sr-only' onchange='toggleTheme()'>
        <div class='absolute inset-0 rounded-full bg-yellow-500/10 border border-yellow-500/40 transition-all duration-300'></div>
        <div id='toggleThumb'
             class='absolute top-1 left-1 w-4 h-4 rounded-full transition-all duration-300 flex items-center justify-center text-xs select-none'
             style='background:linear-gradient(135deg,#fbbf24,#d97706);'>&#9728;</div>
    </label>
}

if { ![Files::Source $param(cfgfile) param] } {
    puts [subst {
        <!DOCTYPE html>
        <html lang='pl' class='dark'>
        <head>
            <title>Config Error</title>
            $sharedHead
        </head>
        <body class='min-h-screen bg-gray-100 dark:bg-gray-950 text-gray-900 dark:text-white'>

            <header class='sticky top-0 z-10 px-8 py-3 flex items-center justify-between
                           bg-gradient-to-r from-blue-950 via-slate-900 to-blue-950
                           border-b border-yellow-500/20'>
                <div class='flex items-center gap-4'>
                    <img src='/custom/jj00sp/img/logo-new.png' class='h-5 flicker'>
                </div>
                <div class='flex items-center gap-3'>
                    <span class='mono text-xs text-yellow-500/35'>v2.0</span>
                    $themeToggle
                </div>
            </header>

            <div class='min-h-screen flex items-center justify-center p-6'>
                <div class='w-full max-w-md
                            bg-white dark:bg-slate-900
                            border border-red-200 dark:border-red-500/30
                            rounded-2xl p-10 shadow-xl'>

                    <div class='flex items-center gap-4 mb-6'>
                        <div class='w-11 h-11 rounded-full flex-shrink-0 flex items-center justify-center
                                    bg-red-50 dark:bg-red-500/10
                                    border border-red-200 dark:border-red-500/40'>
                            <svg class='w-5 h-5 text-red-500 dark:text-red-400' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
                                <path stroke-linecap='round' stroke-linejoin='round' stroke-width='2'
                                      d='M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z'/>
                            </svg>
                        </div>
                        <div>
                            <p class='mono text-xs tracking-widest text-red-500 dark:text-red-400 uppercase mb-1'>Configuration Error</p>
                            <h1 class='text-lg font-bold'>Failed to Load Config</h1>
                        </div>
                    </div>

                    <div class='bg-gray-50 dark:bg-black/30
                                border border-gray-200 dark:border-red-500/15
                                rounded-xl p-4 mb-5'>
                        <p class='mono text-xs tracking-wider text-gray-400 uppercase mb-2'>File Path</p>
                        <code class='mono text-sm text-red-600 dark:text-red-300 break-all'>$param(cfgfile)</code>
                    </div>

                    <p class='text-sm text-gray-500 dark:text-gray-400 leading-relaxed'>
                        Verify the file path exists and has proper read permissions, then reload the page.
                    </p>
                </div>
            </div>
        </body>
        </html>
    }]
    exit
}

if { [info exists param($param(IP))] } {
    global station
    global process
    set station [lindex [split $param($param(IP)) "|" ] 0]
    set process [lindex [split $param($param(IP)) "|" ] 1]
    set instruction_needed [lindex [split $param($param(IP)) "|" ] 2]
    set configFile $param(powerSens)
} else {
    puts [subst {
        <!DOCTYPE html>
        <html lang='pl' class='dark'>
        <head>
            <title>Station Not Configured</title>
            $sharedHead
        </head>
        <body class='min-h-screen bg-gray-100 dark:bg-gray-950 text-gray-900 dark:text-white overflow-hidden'>

            <header class='sticky top-0 z-10 px-8 py-3 flex items-center justify-between
                           bg-gradient-to-r from-blue-950 via-slate-900 to-blue-950
                           border-b border-yellow-500/20'>
                <div class='flex items-center gap-4'>
                    <img src='/custom/jj00sp/img/logo-new.png' class='h-5 flicker'>
                </div>
                <div class='flex items-center gap-3'>
                    <span class='mono text-xs text-yellow-500/35'>v2.0</span>
                    $themeToggle
                </div>
            </header>

            <div class='min-h-screen flex items-center justify-center'>
                <div class='w-full max-w-md text-center
                            bg-white dark:bg-slate-900
                            border border-yellow-200 dark:border-yellow-500/25
                            rounded-2xl p-6 shadow-xl'>

                    <div class='flex justify-center mb-6'>
                        <div class='relative'>
                            <div class='w-20 h-20 rounded-full flex items-center justify-center
                                        bg-yellow-50 dark:bg-yellow-500/10
                                        border-2 border-yellow-300 dark:border-yellow-500/40'>
                                <svg class='w-9 h-9 text-yellow-500 dark:text-yellow-400' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
                                    <path stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5'
                                          d='M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z'/>
                                </svg>
                            </div>
                            <div class='absolute inset-0 rounded-full bg-yellow-400/10 animate-ping' style='animation-duration:2s;'></div>
                        </div>
                    </div>

                    <p class='mono text-xs tracking-widest text-yellow-600 dark:text-yellow-500/70 uppercase mb-2'>Configuration Warning</p>
                    <h2 class='text-2xl font-bold mb-6'>Station Not Configured</h2>

                    <div class='bg-gray-50 dark:bg-black/25
                                border border-yellow-200 dark:border-yellow-500/15
                                rounded-xl p-4 mb-6 text-left'>
                        <p class='mono text-xs tracking-wider text-gray-400 dark:text-yellow-500/50 uppercase mb-2'>Station IP</p>
                        <code class='mono text-sm text-yellow-700 dark:text-yellow-300'>$param(IP)</code>
                    </div>

                    <p class='text-sm text-gray-500 dark:text-gray-400 leading-relaxed mb-8'>
                        Please add this station to the configuration file before proceeding.
                    </p>

                    <a href='/cst_public/$filename'
                       class='inline-flex items-center gap-3
                              bg-gradient-to-r from-amber-500 to-amber-600
                              hover:from-amber-400 hover:to-amber-500
                              text-white font-bold text-sm tracking-wider uppercase
                              py-3 px-8 rounded-xl
                              shadow-lg hover:shadow-amber-500/30
                              transition-all duration-200 hover:-translate-y-0.5'>
                        <svg class='w-4 h-4' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
                            <path stroke-linecap='round' stroke-linejoin='round' stroke-width='2'
                                  d='M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15'/>
                        </svg>
                        Retry / Reset
                    </a>
                </div>
            </div>
        </body>
        </html>
    }]
    exit
}

puts [subst {
    <!DOCTYPE html>
    <html lang='pl' class='dark'>
    <head>
        <title>$process &mdash; FIS1</title>
        <script type='text/javascript' src='https://www.gstatic.com/charts/loader.js'></script>
        <script src='/custom/jj00sp/js/soldering-encore.js' type='module'></script>
        $sharedHead
    </head>
    <body class='soldering-screen bg-gray-100 dark:bg-gray-950 text-gray-900 dark:text-white overflow-hidden'>

        <div id='vacuum_instruction'
            class='fixed inset-0 z-50 hidden items-center justify-center p-4
                bg-white/80 dark:bg-gray-950/95 backdrop-blur-lg'>

            <div class='w-full max-w-5xl max-h-full flex flex-col overflow-hidden
                        bg-white dark:bg-slate-900 rounded-2xl
                        border border-gray-200 dark:border-yellow-500/30 shadow-2xl'>

                <div class='flex-none flex items-center gap-3 px-6 py-4
                            border-b border-gray-100 dark:border-yellow-500/15'>
                    <div class='w-2 h-2 rounded-full bg-amber-500 dark:bg-yellow-400 animate-pulse'></div>
                    <span class='mono text-xs tracking-widest text-amber-700 dark:text-yellow-400/65 uppercase'>Vacuum Check Required</span>
                </div>

                <div class='flex-1 min-h-0 px-6 pt-5 flex justify-center'>
                    <img src='/custom/jj00sp/img/vacuum_instruction.png'
                        class='w-full h-full object-contain rounded-xl
                            border border-gray-200 dark:border-white/5 bg-gray-50 dark:bg-transparent'>
                </div>

                <div class='flex-none flex justify-center px-6 py-7' id='vacuum_instruction_button_container'>
                    <button id='vacuum_instruction_button' disabled
                            class='flex items-center gap-4 font-bold py-4 px-10 rounded-xl
                                text-sm tracking-wider uppercase
                                bg-gradient-to-r from-amber-400 to-amber-600
                                text-amber-950 opacity-50 cursor-not-allowed
                                transition-all duration-200'>
                        <span class='relative w-8 h-8 flex-shrink-0'>
                            <svg class='w-8 h-8' style='transform:rotate(-90deg);' viewBox='0 0 44 44'>
                                <circle cx='22' cy='22' r='20' fill='none' stroke='rgba(0,0,0,0.2)' stroke-width='3'/>
                                <circle id='countdown_ring' cx='22' cy='22' r='20' fill='none'
                                        stroke='rgba(0,0,0,0.5)' stroke-width='3' class='countdown-ring'/>
                            </svg>
                        </span>
                        <span id='vacuum_instruction_button_text'>15 sekund</span>
                    </button>
                </div>
            </div>
        </div>

		<header class='sticky top-0 z-10 px-4 md:px-8 py-3 flex items-center justify-between
					bg-gradient-to-r from-blue-950 via-slate-900 to-blue-950
					border-b border-yellow-500/20'>

			<div class='flex-1 flex justify-start'>
				<img src='/custom/jj00sp/img/logo-new.png' class='h-3 md:h-4 lg:h-5 flicker flex-shrink-0'>
			</div>

			<div class='flex items-center justify-center gap-3 md:gap-5 flex-shrink-0'>
				<div class='text-center hidden sm:block'>
					<div class='mono text-xs tracking-widest text-yellow-500/50 uppercase mb-0.5'>Process</div>
					<div id='process' class='text-sm md:text-base font-bold tracking-wide text-yellow-400'>$process</div>
					<div id='instruction_needed' class='text-sm md:text-base font-bold tracking-wide text-yellow-400 hidden'>$instruction_needed</div>
				</div>

				<div class='hidden sm:block w-px h-6 md:h-8 bg-yellow-500/20'></div>

				<div class='text-center'>
					<div class='mono text-xs tracking-widest text-yellow-500/50 uppercase mb-0.5 hidden sm:block'>Station</div>
					<div id='station' class='text-sm md:text-base font-bold tracking-wide text-white'>$station</div>
				</div>

				<div class='hidden md:block w-px h-8 bg-yellow-500/20'></div>

				<div class='text-center hidden md:block'>
					<div class='mono text-xs tracking-widest text-yellow-500/50 uppercase mb-0.5'>System</div>
					<div class='text-base font-bold tracking-widest text-white glow flicker'>FIS1</div>
				</div>
			</div>

			<div class='flex-1 flex items-center gap-3 md:gap-4 justify-end'>
				<span class='hidden sm:inline mono text-xs text-yellow-500/35'>v2.0</span>
				$themeToggle
			</div>
		</header>

        <input id='configFile' disabled type='hidden' value='$configFile'>

        <main class='flex flex-col justify-between'>

            <section id='formBox' class='flex-1 flex flex-col items-center'>
                <div class='w-full max-w-sm
                            bg-white dark:bg-slate-900
                            border border-gray-200 dark:border-white/7
                            rounded-2xl p-8 shadow-xl mt-10 md:mt-15'>
                    <form id='palletForm'
                          class='flex flex-col items-center gap-5'>
                        <label for='palletSerialNumber'
                               class='mono text-xl tracking-widest uppercase text-black dark:text-white'>
                            [Language::getPhrase jj00sp_scanpallet]
                        </label>
                        <input type='text'
                               id='palletSerialNumber'
                               data-vacuum_check='0'
                               style='text-transform:uppercase; caret-color:#fbbf24; font-family:"Share Tech Mono",monospace;'
                               class='w-full text-center text-xl tracking-widest
                                      text-amber-700 dark:text-yellow-300
                                      bg-gray-50 dark:bg-black/40
                                      border-2 border-amber-200 dark:border-yellow-500/30
                                      rounded-xl p-3 outline-none
                                      focus:border-amber-500 dark:focus:border-yellow-400
                                      transition-all duration-200'
                               autocomplete='off' required>
                    </form>
                </div>
            </section>

            <section class='flex justify-center pb-6'>
                <a id='reloadButton' href='/cst_public/$filename'
                   class='inline-flex items-center gap-2
                          mono text-xs font-semibold tracking-wider uppercase
                          py-2.5 px-6 rounded-xl
                          bg-white dark:bg-slate-900
                          border border-gray-300 dark:border-white/10
                          text-gray-500 dark:text-gray-400
                          hover:border-yellow-400/40 hover:text-gray-800 dark:hover:text-white
                          transition-all duration-200'>
                    <svg class='w-3.5 h-3.5' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
                        <path stroke-linecap='round' stroke-linejoin='round' stroke-width='2'
                              d='M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15'/>
                    </svg>
                    Reset
                </a>
            </section>

            <section id='messagebox' class='flex justify-center' role='alert' aria-atomic='true'></section>
        </main>
    </body>
    </html>
}]
