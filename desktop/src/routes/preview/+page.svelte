<script context="module">
  export const prerender = true;
</script>

<script>
  import {find, cloneDeep, flattenDeep, chain} from 'lodash-es'
  import {onMount, setContext, tick} from 'svelte'
  import PureComponent from '@primo-app/primo/src/views/editor/Layout/PureComponent.svelte'
  import { wrapInStyleTags, processCode } from '@primo-app/primo/src/utils';
  import {browser} from '$app/environment'

  let channel
  let html

  onMount(() => {
    channel = new BroadcastChannel('site_preview')

    import('../../compiler/processors').then(module => {
      html = module.html
      setupChannel()
    })
  })

  setContext('is-preview', true)

  function setupChannel() {
    channel.onmessage = (async ({data}) => {
      const { site:newSite, pageID:newPageID } = data
      if (newSite.id === 'default') return
      const newPage = find(newSite.pages, ['id', newPageID])
      const {css} = await await window.primo.processCSS(newSite.code.css + newPage.code.css);
      const pageIDs = flattenDeep(newSite.pages.map(page => [page.id, ...page.pages.map(p => p.id)]))
      const siteContent = chain(Object.entries(newSite.content['en']).filter(([page]) => !pageIDs.includes(page))).map(([page, sections]) => ({ page, sections })).keyBy('page').mapValues('sections').value()
      const code = await html({
        code: {
          html: `
            <svelte:head>
              ${newSite.code.html.head}${newPage.code.html.head}
              ${wrapInStyleTags(css)}
            </svelte:head>`,
          css: '',
          js: '',
        },
        data: siteContent,
      })
      htmlHead = code.html
      site = cloneDeep(newSite)
      activePageID = newPageID
      activePage = find(site.pages, ['id', activePageID])

      setTimeout(() => {
        ready = true
      }, 100)
    })
    channel.postMessage('READY')
  }

  function hydrateInstance(block, symbols) {
    const symbol = find(symbols, ['id', block.symbolID]);
    return {
      ...symbol,
      id: block.id,
      type: block.type,
      symbolID: block.symbolID
    }
  }

  let site 
  let activePageID = 'index'

  let activePage
  // $: activePage = site ? find(site.pages, ['id', activePageID]) : null

  let ready

  let htmlHead = ''
</script>

{@html htmlHead}
{#key activePageID}
  {#if activePage}
    <div
      class:fadein={ready}
      class="primo-page being-edited">
        {#each activePage.sections as section, i (section.id)}
          {#if section.symbolID}
            <PureComponent {site} block={hydrateInstance(section, site.symbols)} />
          {:else if section.type === 'content'}
            <PureComponent {site} block={section} />
          {/if}
        {/each}
    </div>
  {/if}
{/key}

<style>
  .primo-page {
    transition: 0.1s opacity;
    opacity: 0;
  }

  .fadein {
    opacity: 1;
  }
</style>