<script context="module">
  import {writable} from 'svelte/store'
  const activeTab = writable(0)
</script>

<script>
  import {_ as C} from 'svelte-i18n';
  import { cloneDeep, isEqual } from 'lodash-es';
  import { Tabs } from '../../components/misc';
  import { CodeMirror } from '../../components';
  import ModalHeader from './ModalHeader.svelte';

  import modal from '../../stores/app/modal';
  import { code as pageCode } from '../../stores/app/activePage';
  import { saved } from '../../stores/app/misc';
  import { code as siteCode } from '../../stores/data/draft';
  import {
    updateHTML
  } from '../../stores/actions';

  let localPageHTML = cloneDeep($pageCode.html);
  let localSiteHTML = cloneDeep($siteCode.html);

  async function saveFinalHTML() {
    updateHTML({
      page: localPageHTML,
      site: localSiteHTML
    })
    $saved = false;
  }

  const tabs = [
    {
      id: 'page',
      label: $C('Page'),
      icon: 'square',
    },
    {
      id: 'site',
      label: $C('Site'),
      icon: 'th',
    },
  ];

</script>

<ModalHeader
  icon="fab fa-html5"
  title="HTML"
  button={{
    label: `Draft`,
    icon: 'fas fa-check',
    onclick: () => {
      saveFinalHTML();
      modal.hide();
    },
  }}
  warn={() => {
    if (
      !isEqual(localPageHTML, $pageCode.html) ||
      !isEqual(localSiteHTML, $siteCode.html)
    ) {
      const proceed = window.confirm(
        'Undrafted changes will be lost. Continue?'
      );
      return proceed;
    } else return true;
  }}
/>

<main>
  <Tabs {tabs} bind:activeTab={$activeTab} />
  <div class="editors">
    {#if $activeTab === 0}
      <div class="editor-head">
        <span class="head">{'<head>'}</span>
        <CodeMirror
          bind:value={localPageHTML.head}
          style="height:10rem"
          mode="html"
          docs="https://docs.primo.so/development#html-1"
        />
      </div>
      <div class="editor-body">
        <span class="before-body">{'Before </body>'}</span>
        <CodeMirror
          bind:value={localPageHTML.below}
          style="height:15rem"
          mode="html"
          docs="https://docs.primo.so/development#beforeclosingbodytag"
        />
      </div>
    {:else}
      <div class="editor-head">
        <span class="head">{'<head>'}</span>
        <CodeMirror
          bind:value={localSiteHTML.head}
          style="height:10rem"
          mode="html"
          docs="https://docs.primo.so/development#html-1"
        />
      </div>
      <div class="editor-body">
        <span class="before-body">{'Before </body>'}</span>
        <CodeMirror
          bind:value={localSiteHTML.below}
          style="height:15rem"
          mode="html"
          docs="https://docs.primo.so/development#beforeclosingbodytag"
        />
      </div>
    {/if}
  </div>
</main>

<style lang="postcss">
  main {
    background: var(--primo-color-black);
    display: flex;
    flex-direction: column;
    padding: 0.5rem;

    .editors {
      flex: 1;

      .head {
        margin-bottom: 0.25rem;
        display: inline-block;
        font-weight: 600;
        color: var(--color-gray-2);
      }

      .before-body {
        margin-bottom: 0.25rem;
        margin-top: 0.75rem;
        display: inline-block;
        font-weight: 600;
        color: var(--color-gray-2);
      }
    }
  }
</style>
