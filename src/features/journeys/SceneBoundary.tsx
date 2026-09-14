import { Component } from 'react'
import type { ReactNode } from 'react'

export class SceneBoundary extends Component<{children:ReactNode},{failed:boolean}>{
  state={failed:false}
  static getDerivedStateFromError(){return {failed:true}}
  render(){return this.state.failed?<div className="ms-scene-error" role="alert"><h2>风景暂时没有加载完成</h2><p>旅程与笔记已经保留，可以重新加载继续。</p><button type="button" onClick={()=>window.location.reload()}>重新加载风景</button><a href="/observatory">返回观星台</a></div>:this.props.children}
}
