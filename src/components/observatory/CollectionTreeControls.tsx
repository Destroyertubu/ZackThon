import { ArrowLeft, ArrowRight, ArrowUpRight, X } from 'lucide-react'
import './collection-tree-controls.css'

export interface CollectionTreeControlsProps {
  ready: boolean
  error: string
  collectionCount: number
  topicCount: number
  selectedTopicLabel: string | null
  selectedTopicLeafCount: number
  /** Pages are zero-based; only the displayed page number is one-based. */
  topicPage: number
  topicPages: number
  leafPage: number
  leafPages: number
  onTopicPage: (page: number) => void
  onLeafPage: (page: number) => void
  onBackTopics: () => void
  onExplore: () => void
  onClose: () => void
}

/** Presentation only. The page owns focus, movement lock, data and selection. */
export default function CollectionTreeControls({
  ready,
  error,
  collectionCount,
  topicCount,
  selectedTopicLabel,
  selectedTopicLeafCount,
  topicPage,
  topicPages,
  leafPage,
  leafPages,
  onTopicPage,
  onLeafPage,
  onBackTopics,
  onExplore,
  onClose,
}: CollectionTreeControlsProps) {
  const hasTopic = selectedTopicLabel !== null
  const totalPages = hasTopic ? leafPages : topicPages
  const requestedPage = hasTopic ? leafPage : topicPage
  const pages = Math.max(1, Number.isFinite(totalPages) ? Math.trunc(totalPages) : 1)
  const page = Math.min(pages - 1, Math.max(0, Number.isFinite(requestedPage) ? Math.trunc(requestedPage) : 0))
  const changePage = hasTopic ? onLeafPage : onTopicPage
  const pageKind = hasTopic ? '星叶' : '主题'
  const empty = ready && !error && collectionCount === 0
  const showNavigation = ready && collectionCount > 0

  return <div className={`collection-tree-controls${hasTopic ? ' collection-tree-controls--topic' : ''}`} data-collection-tree-controls="">
    <header className="collection-tree-controls__header">
      <div className="collection-tree-controls__heading">
        <p className="collection-tree-controls__scope">留在当前浏览器</p>
        <h2 id="collection-tree-title" className="collection-tree-controls__title">我的星树</h2>
        {ready && collectionCount > 0 && <p className="collection-tree-controls__totals">
          {collectionCount} 条收藏<span aria-hidden="true"> · </span>{topicCount} 个主题
        </p>}
      </div>
      <button type="button" className="collection-tree-controls__button collection-tree-controls__close"
        data-collection-tree-control="close" data-tree-close="" onClick={onClose}
        aria-label="关闭我的星树，返回花园" aria-keyshortcuts="Escape">
        <X size={21} strokeWidth={1.4} aria-hidden="true"/>
        <span>关闭</span>
      </button>
    </header>

    <footer className="collection-tree-controls__footer">
      <div className="collection-tree-controls__message">
        {hasTopic && <div className="collection-tree-controls__selected-topic">
          <div className="collection-tree-controls__selection"
            role="region" aria-label="当前主题完整名称" tabIndex={0} data-collection-tree-control="topic-label">
            <p className="collection-tree-controls__selected-label">{selectedTopicLabel || '未命名主题'}</p>
          </div>
          <p className="collection-tree-controls__leaf-count">{selectedTopicLeafCount} 片星叶</p>
        </div>}
        {error && <div className="collection-tree-controls__error" role="alert">
          <p>收藏暂时未能完整展开</p>
          <p className="collection-tree-controls__error-detail" role="region" tabIndex={0}
            data-collection-tree-control="error-detail" aria-label="收藏读取错误详情">{error}</p>
        </div>}
        {!ready && !error && <p className="collection-tree-controls__loading" role="status">
          <span className="collection-tree-controls__breath" aria-hidden="true"/>
          正在展开收藏枝头…
        </p>}
        {empty && <div className="collection-tree-controls__empty">
          <p className="collection-tree-controls__empty-title">枝头还在等第一片星叶。</p>
          <p>这里还没有收藏。去星空留下一段感兴趣的内容，它会在这棵树上生长。</p>
          <button type="button" className="collection-tree-controls__button collection-tree-controls__explore"
            data-collection-tree-control="explore" onClick={onExplore}>
            <span>去星空摘星</span><ArrowUpRight size={18} strokeWidth={1.5} aria-hidden="true"/>
          </button>
        </div>}
        {showNavigation && !error && !hasTopic && <p className="collection-tree-controls__hint">
          轻触眼前的主题，沿枝头展开收藏。
        </p>}
      </div>

      {showNavigation && <div className="collection-tree-controls__navigation">
        {hasTopic && <button type="button" className="collection-tree-controls__button collection-tree-controls__back"
          data-collection-tree-control="back-topics" onClick={onBackTopics}>
          <ArrowLeft size={17} strokeWidth={1.4} aria-hidden="true"/><span>回到所有枝头</span>
        </button>}
        <nav className="collection-tree-controls__pager" aria-label={`收藏${pageKind}分页`}>
          <button type="button" className="collection-tree-controls__button collection-tree-controls__page-button"
            data-collection-tree-control={hasTopic ? 'previous-leaves' : 'previous-topics'}
            disabled={page === 0} onClick={() => changePage(page - 1)} aria-label={`上一页${pageKind}`}>
            <ArrowLeft size={17} strokeWidth={1.4} aria-hidden="true"/><span>上一页</span>
          </button>
          <p className="collection-tree-controls__page-number" aria-live="polite" aria-atomic="true">
            <span>{pageKind}</span><span>{page + 1}<span aria-hidden="true"> / </span><span className="collection-tree-controls__sr-only">，共</span>{pages}<span className="collection-tree-controls__sr-only">页</span></span>
          </p>
          <button type="button" className="collection-tree-controls__button collection-tree-controls__page-button"
            data-collection-tree-control={hasTopic ? 'next-leaves' : 'next-topics'}
            disabled={page >= pages - 1} onClick={() => changePage(page + 1)} aria-label={`下一页${pageKind}`}>
            <span>下一页</span><ArrowRight size={17} strokeWidth={1.4} aria-hidden="true"/>
          </button>
        </nav>
      </div>}
    </footer>
  </div>
}
