import React from 'react';
import { Menu, Dropdown, Icon } from 'antd';
import { Button } from 'antd';
import { Cascader } from 'antd';
import { reduxForm } from 'redux-form';
import { Form, Input, Checkbox } from 'antd';
import { Pagination } from 'antd';
import styles from './styles';
import pic from './gg.png'
import ShoppingInfoTable from '../ShoppingInfoTable'
import { Card, Col, Row } from 'antd';

const optionsPrice = [{
  value: 'priceLowToHigh',
  label: '价格从小到大'
},{
  value: 'priceHighToLow',
  label: '价格从大到小'
}];

const optionsCategory = [{
  value: 'isElectronic',
  label: '电子产品'
},{
  value: 'isDaily',
  label: '日用'
},{
  value:'isFood',
  label:'食品'
},{
  value:'isCloth',
  label:'服饰'
}];

function onChange(value) {
  console.log(value);
}
@reduxForm({
  form: 'searchItem',
  fields: ['searchString']
}, undefined, {
  onSubmit: (data) => console.log(data)
})

class ShoppingInfoPage extends React.Component {
  render() {
    const { fields: {
       searchString
    }, handleSubmit } = this.props;
    const contents = Array(5).fill({ 
        pic:'https://os.alipayobjects.com/rmsportal/QBnOOoLaAfKPirc.png',
        title: 'sea',
        price: '$12450.00',
        publisher: 'woot'
    });
    return (
     <div className={styles.container}>
     <div className={styles.upperHalf}>
        <nobr>
          <Cascader className={styles.cascader} placeholder="请选择排序类型" options={optionsPrice} onChange={onChange} />
          <Cascader className={styles.cascader} placeholder="请选择商品类别" options={optionsCategory} onChange={onChange} />
          <Input className={styles.inputbox} placeholder="请输入关键字" {...searchString} />
          <Button type="ghost" className={styles.button}>搜索</Button>
        </nobr>
      </div>
      <Row type="flex" justify="start" align="left">
        {
          contents.map((e,i) => (
            <Col span={8}>
            <ShoppingInfoTable className={styles.row} key={i} content={e} />
            </Col>
          ))
        }   
      </Row>
        <Pagination simple defaultCurrent={2} total={12450} />
    </div>
    );
  }
}

export default ShoppingInfoPage;
