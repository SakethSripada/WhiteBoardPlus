/* eslint-disable @typescript-eslint/no-explicit-any */

import { BaseBoxShapeUtil, HTMLContainer, Rectangle2d, resizeBox } from 'tldraw'
import { createDefaultCodeShapeProps, createDefaultTableShapeProps } from './constants'
import type { CodeShape, CodeShapeProps, TableShape, TableShapeProps } from './types'

export class CodeShapeUtil extends BaseBoxShapeUtil<any> {
  static override type = 'code' as const

  override getDefaultProps(): CodeShapeProps {
    return createDefaultCodeShapeProps()
  }

  override canEdit() {
    return true
  }

  override canScroll() {
    return true
  }

  override hideResizeHandles() {
    return false
  }

  override getGeometry(shape: CodeShape) {
    return new Rectangle2d({
      width: shape.props.w,
      height: shape.props.h,
      isFilled: true,
    })
  }

  override onResize(shape: CodeShape, info: Parameters<typeof resizeBox>[1]) {
    return resizeBox(shape as any, info, {
      minWidth: 340,
      minHeight: 220,
    })
  }

  override component(shape: CodeShape) {
    return (
      <HTMLContainer className="code-shape-shell" style={{ pointerEvents: 'none' }}>
        <div className="code-shape-proxy" style={{ width: shape.props.w, height: shape.props.h }} />
      </HTMLContainer>
    )
  }

  override indicator(shape: CodeShape) {
    return <rect width={shape.props.w} height={shape.props.h} rx={18} ry={18} />
  }
}

export class TableShapeUtil extends BaseBoxShapeUtil<any> {
  static override type = 'table' as const

  override getDefaultProps(): TableShapeProps {
    return createDefaultTableShapeProps()
  }

  override canEdit() {
    return true
  }

  override canScroll() {
    return true
  }

  override hideResizeHandles() {
    return false
  }

  override getGeometry(shape: TableShape) {
    return new Rectangle2d({
      width: shape.props.w,
      height: shape.props.h,
      isFilled: true,
    })
  }

  override onResize(shape: TableShape, info: Parameters<typeof resizeBox>[1]) {
    return resizeBox(shape as any, info, {
      minWidth: 360,
      minHeight: 220,
    })
  }

  override component(shape: TableShape) {
    return (
      <HTMLContainer className="table-shape-shell" style={{ pointerEvents: 'none' }}>
        <div className="table-shape-proxy" style={{ width: shape.props.w, height: shape.props.h }} />
      </HTMLContainer>
    )
  }

  override indicator(shape: TableShape) {
    return <rect width={shape.props.w} height={shape.props.h} rx={18} ry={18} />
  }
}
