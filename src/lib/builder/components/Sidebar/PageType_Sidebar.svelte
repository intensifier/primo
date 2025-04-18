<script>
	import _ from 'lodash-es'
	import fileSaver from 'file-saver'
	import axios from 'axios'
	import { userRole } from '../../stores/app/misc.js'
	import modal from '../../stores/app/modal.js'
	import site from '../../stores/data/site.js'
	import { page } from '$app/stores'
	import { goto } from '$app/navigation'
	import { browser } from '$app/environment'
	import { dynamic_field_types } from '$lib/builder/field-types'
	import { remap_entry_and_field_items } from '$lib/builder/actions/_db_utils'
	import page_type from '../../stores/data/page_type.js'
	import symbols from '../../stores/data/symbols.js'
	import UI from '../../ui/index.js'
	import Icon from '@iconify/svelte'
	import { debounce } from '$lib/builder/utils'
	import { site_design_css } from '../../code_generators.js'
	import Sidebar_Symbol from './Sidebar_Symbol.svelte'
	import Content from '$lib/builder/components/Content.svelte'
	import { toggle_symbol, update_page_type_entries } from '../../actions/page_types.js'
	import { move_block, rename_block, update_block, add_block_to_site, delete_block_from_site, add_multiple_symbols } from '$lib/builder/actions/symbols.js'
	import { v4 as uuidv4 } from 'uuid'
	import { validate_symbol } from '../../converter.js'
	import { get_ancestors } from '$lib/builder/actions/_helpers.js'
	import { flip } from 'svelte/animate'
	import { dropTargetForElements } from '../../libraries/pragmatic-drag-and-drop/entry-point/element/adapter.js'
	import { attachClosestEdge, extractClosestEdge } from '../../libraries/pragmatic-drag-and-drop-hitbox/closest-edge.js'
	import { site_html } from '$lib/builder/stores/app/page'
	import * as Dialog from '$lib/components/ui/dialog'
	import { Button } from '$lib/components/ui/button'
	import DropZone from '$lib/components/DropZone.svelte'
	import { Input } from '$lib/components/ui/input'
	import { Loader } from 'lucide-svelte'
	import * as Tabs from '$lib/components/ui/tabs'
	import { Cuboid, SquarePen } from 'lucide-svelte'

	// get the query param to set the tab when navigating from page (i.e. 'Edit Fields')
	let active_tab = $state($page.url.searchParams.get('t') === 'p' ? 'CONTENT' : 'BLOCKS')
	if (browser) {
		const url = new URL($page.url)
		url.searchParams.delete('t')
		goto(url, { replaceState: true })
	}

	async function create_block() {
		modal.show(
			'BLOCK_EDITOR',
			{
				header: {
					title: `Create Block'}`,
					icon: 'fas fa-check',
					button: {
						label: `Save Block`,
						icon: 'fas fa-check',
						onclick: (new_block, changes) => {
							add_block_to_site({
								symbol: new_block,
								index: 0
							})
							modal.hide()
						}
					}
				},
				tab: 'code'
			},
			{
				showSwitch: true,
				disabledBgClose: true
			}
		)
	}

	function edit_block(block) {
		modal.show(
			'BLOCK_EDITOR',
			{
				block,
				header: {
					title: `Edit ${block.title || 'Block'}`,
					icon: 'fas fa-check',
					button: {
						label: `Save Block`,
						icon: 'fas fa-check',
						onclick: (updated_data) => {
							modal.hide()
							update_block({ block, updated_data })
						}
					}
				},
				tab: 'code'
			},
			{
				showSwitch: true,
				disabledBgClose: true
			}
		)
	}

	async function show_block_picker() {
		modal.show(
			'BLOCK_PICKER',
			{
				site: $site,
				append: site_design_css($site.design),
				onsave: (symbols) => {
					add_multiple_symbols(symbols)
					modal.hide()
				}
			},
			{
				hideLocaleSelector: true
			}
		)
	}

	async function delete_block(block) {
		delete_block_from_site(block)
	}

	async function duplicate_block(block_id, index) {
		const symbol = $symbols.find((s) => s.id === block_id)
		const new_symbol = _.cloneDeep(symbol)
		new_symbol.id = uuidv4()
		delete new_symbol.created_at
		new_symbol.name = `${new_symbol.name} (copy)`
		add_block_to_site({
			symbol: new_symbol,
			index
		})
	}

	async function upload_block({ target }) {
		var reader = new window.FileReader()
		reader.onload = async function ({ target }) {
			if (typeof target.result !== 'string') return
			try {
				const uploaded = JSON.parse(target.result)
				const validated = validate_symbol(uploaded)
				add_block_to_site({
					symbol: validated,
					index: 0
				})
			} catch (error) {
				console.error(error)
			}
		}
		reader.readAsText(target.files[0])
	}

	async function download_block(block_id) {
		const block = $symbols.find((s) => s.id === block_id)
		const isolated_block = _.cloneDeep(isolate_block(block))
		remap_entry_and_field_items({
			fields: isolated_block.fields,
			entries: isolated_block.entries
		})
		const json = JSON.stringify(isolated_block)
		var blob = new Blob([json], { type: 'application/json' })
		fileSaver.saveAs(blob, `${block.name || block.id}.json`)
	}

	function isolate_block(block) {
		const has_dynamic_field = block.fields.some((f) => dynamic_field_types.includes(f.type))
		if (!has_dynamic_field) return block

		const isolated_fields = []
		const isolated_entries = []

		for (const field of block.fields) {
			const is_dynamic = dynamic_field_types.includes(field.type)
			if (!is_dynamic) {
				isolated_fields.push(field)
				for (const entry of block.entries) {
					const parent_entry = block.entries.find((e) => e.id === entry.parent)
					if (entry.field === field.id || parent_entry?.field === field.id) {
						isolated_entries.push(entry)
					}
				}
			}

			if (field.type === 'site-field') {
				const source_field = $site.fields.find((f) => f.id === field.source)
				const dependent_source_fields = $site.fields.filter((site_field) => {
					const ancestors = get_ancestors(site_field, $site.fields)
					const is_descendent = ancestors.some((a) => a.id === source_field.id)
					return is_descendent
				})
				const site_fields = [{ ...source_field, key: field.key }, ...dependent_source_fields]
				isolated_fields.push(...site_fields)

				for (const entry of $site.entries) {
					const parent_entry = $site.entries.find((e) => e.id === entry.parent)
					if (site_fields.some((f) => f.id === entry.field || f.id === parent_entry?.field)) {
						isolated_entries.push(entry)
					}
				}
			}

			if (field.type === 'page-field') {
				const source_field = $page_type.fields.find((f) => f.id === field.source)
				const dependent_source_fields = $page_type.fields.filter((pt_field) => {
					const ancestors = get_ancestors(pt_field, $page_type.fields)
					const is_descendent = ancestors.some((a) => a.id === source_field.id)
					return is_descendent
				})
				const page_fields = [{ ...source_field, key: field.key }, ...dependent_source_fields]
				isolated_fields.push(...page_fields)

				for (const entry of $page_type.entries) {
					const parent_entry = $page_type.entries.find((e) => e.id === entry.parent)
					if (entry.field === source_field.id || parent_entry?.field === source_field.id) {
						isolated_entries.push(entry)
					}
				}
			}
		}

		return {
			...block,
			fields: isolated_fields.map((f) => ({ ...f, symbol: null, page_type: null, site: null, owner_site: null })),
			entries: isolated_entries.map((e) => ({ ...e, symbol: null, page_type: null, site: null, owner_site: null }))
		}
	}

	let dragging = $state(null)

	function drag_target(element, block) {
		dropTargetForElements({
			element,
			getData({ input, element }) {
				return attachClosestEdge(
					{ block },
					{
						element,
						input,
						allowedEdges: ['top', 'bottom']
					}
				)
			},
			onDrag({ self, source }) {
				// if (dragging.id !== self.data.block.id) {
				// 	// dragging = {
				// 	// 	id: self.data.block.id,
				// 	// 	position: extractClosestEdge(self.data)
				// 	// }
				// }
			},
			onDragLeave() {
				// reset_drag()
			},
			onDrop({ self, source }) {
				const block_dragged_over_index = $symbols.find((s) => s.id === self.data.block.id).index
				const block_being_dragged = source.data.block
				const closestEdgeOfTarget = extractClosestEdge(self.data)
				if (closestEdgeOfTarget === 'top') {
					move_block(block_being_dragged, block_dragged_over_index)
				} else if (closestEdgeOfTarget === 'bottom') {
					move_block(block_being_dragged, block_dragged_over_index + 1)
				}
				// reset_drag()
			}
		})
	}
</script>

<div class="sidebar primo-reset">
	<Tabs.Root value="blocks" class="p-2">
		<Tabs.List class="w-full mb-2">
			<Tabs.Trigger value="blocks" class="flex-1 flex gap-1">
				<Cuboid class="w-3" />
				<!-- <span class="text-xs">Page Blocks</span> -->
			</Tabs.Trigger>
			<Tabs.Trigger value="content" class="flex-1 flex gap-1">
				<SquarePen class="w-3" />
				<!-- <span class="text-xs">Page Content</span> -->
			</Tabs.Trigger>
		</Tabs.List>
		<Tabs.Content value="blocks" class="px-1">
			{#if $symbols.length > 0}
				<div class="primo-buttons">
					<button class="primo-button" onclick={show_block_picker}>
						<Icon icon="mdi:plus" />
						<span>Add</span>
					</button>
					{#if $userRole === 'DEV'}
						<button class="primo-button" onclick={create_block}>
							<Icon icon="mdi:code" />
							<span>Create</span>
						</button>

						<!-- <UI.Dropdown>
							<button class="primo-button" slot="trigger">
								<Icon icon="mdi:code" />
								<span>Create</span>
							</button>
							<div class="dropdown-content">
								<button class="dropdown-item" onclick={create_block}>
									<Icon icon="mdi:code" />
									<span>From Scratch</span>
								</button>
								<button class="dropdown-item" onclick={create_block_from_prompt}>
									<Icon icon="mdi:robot" />
									<span>From Prompt</span>
								</button>
							</div>
						</UI.Dropdown> -->
					{/if}
					<label class="primo-button">
						<input onchange={upload_block} type="file" accept=".json" />
						<Icon icon="mdi:upload" />
						<span>Upload</span>
					</label>
				</div>
				<!-- svelte-ignore missing_declaration -->
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				{#if $site_html !== null}
					<div class="block-list">
						{#each $symbols.sort((a, b) => a.index - b.index) as symbol, i (symbol.id)}
							{@const toggled = symbol.page_types?.includes($page_type.id)}
							<div class="block" animate:flip={{ duration: 200 }} use:drag_target={symbol}>
								<Sidebar_Symbol
									{symbol}
									head={$site_html}
									append={site_design_css($site.design)}
									show_toggle={true}
									{toggled}
									on:toggle={({ detail }) => {
										if (detail === toggled) return // dispatches on creation for some reason
										toggle_symbol({
											symbol_id: symbol.id,
											page_type_id: $page_type.id,
											toggled: detail
										})
									}}
									onmousedown={() => (dragging = symbol._drag_id)}
									onmouseup={() => (dragging = null)}
									on:edit={() => edit_block(symbol)}
									on:rename={({ detail: name }) => rename_block({ block: symbol, name })}
									on:download={() => download_block(symbol.id)}
									on:delete={() => delete_block(symbol)}
									on:duplicate={() => duplicate_block(symbol.id, i + 1)}
								/>
							</div>
						{/each}
					</div>
				{:else}
					<div style="display: flex;justify-content: center;font-size: 2rem;color:var(--color-gray-6)">
						<UI.Spinner variant="loop" />
					</div>
				{/if}
			{:else}
				<div class="empty">Add a Block to your site to use it on your pages.</div>
				<div class="primo-buttons">
					<button class="primo-button" onclick={show_block_picker}>
						<Icon icon="mdi:plus" />
						<span>Add</span>
					</button>
					<button class="primo-button" onclick={create_block}>
						<Icon icon="mdi:code" />
						<span>Create</span>
					</button>
					<label class="primo-button">
						<input onchange={upload_block} type="file" accept=".json" />
						<Icon icon="mdi:upload" />
						<span>Upload</span>
					</label>
				</div>
			{/if}
		</Tabs.Content>
		<Tabs.Content value="content" class="px-1">
			<div class="page-type-fields">
				{#if $userRole === 'DEV'}
					<button class="primo--link" style="margin-bottom: 1rem" onclick={() => modal.show('PAGE_EDITOR')}>
						<Icon icon="mdi:code" />
						<span>Edit Page Type</span>
					</button>
				{/if}
				<Content
					fields={$page_type.fields}
					entries={$page_type.entries}
					on:input={debounce({
						instant: ({ detail }) => update_page_type_entries.store(detail.updated),
						delay: ({ detail }) => update_page_type_entries.db(detail.original, detail.updated)
					})}
					minimal={true}
				/>
			</div>
		</Tabs.Content>
	</Tabs.Root>
</div>

<style lang="postcss">
	.sidebar {
		width: 100%;
		background: #111;
		z-index: 9;
		display: flex;
		flex-direction: column;
		height: calc(100vh - 59px);
		/* height: 100%; */
		/* gap: 0.5rem; */
		z-index: 9;
		position: relative;
		overflow: auto;
		/* overflow: hidden; */
		/* padding-top: 0.5rem; */
	}

	.empty {
		font-size: 0.75rem;
		color: var(--color-gray-2);
		padding-bottom: 0.25rem;
	}

	.primo-buttons {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.primo-button {
		padding: 0.25rem 0.5rem;
		/* color: #b6b6b6;
			background: #292929; */
		color: var(--color-gray-2);
		background: var(--color-gray-8);
		border-radius: 4px;
		cursor: pointer;
		display: flex;
		gap: 0.25rem;
		align-items: center;
		font-size: 0.75rem;

		input {
			display: none;
		}
	}

	.container {
		display: flex;
		flex-direction: column;
		overflow-y: auto;
		padding: 1rem;
		gap: 0.75rem;
	}

	.block-list {
		/* gap: 1rem; */
		flex: 1;
		display: flex;
		flex-direction: column;

		.block {
			padding-block: 0.5rem;
		}

		.block:first-child {
			padding-top: 0;
		}
	}
</style>
